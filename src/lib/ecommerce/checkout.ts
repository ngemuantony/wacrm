import { format } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/utils/encryption';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TriggerMpesaArgs {
  accountId: string;
  productId: string;
  contactId: string;
  phoneNumber: string;
  userId: string; // The owner user id to link the transaction to
  deliveryFee?: number; // Optional delivery fee to add to product price
  deliveryAddress?: string; // Optional delivery address
}

export async function triggerMpesaCheckout(args: TriggerMpesaArgs): Promise<{ success: boolean; message?: string }> {
  const { accountId, productId, contactId, phoneNumber, userId, deliveryFee, deliveryAddress } = args;

  // 1. Fetch Product Price
  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('price, name')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    console.error('Failed to fetch product for M-Pesa checkout', productError);
    return { success: false, message: 'Product not found.' };
  }

  const amount = Math.floor(product.price) + Math.floor(args.deliveryFee || 0);

  if (!args.accountId) {
    return { success: false, message: 'Missing account ID' };
  }

  // Fetch Daraja credentials from the database
  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .select('daraja_consumer_key, daraja_consumer_secret, daraja_passkey, daraja_shortcode, daraja_type, mpesa_webhook_secret')
    .eq('id', args.accountId)
    .single();

  if (accountError || !account) {
    console.error('Failed to fetch account for M-Pesa:', accountError);
    return { success: false, message: 'Account not found or configuration missing' };
  }

  const consumerKey = decrypt(account.daraja_consumer_key);
  const consumerSecret = decrypt(account.daraja_consumer_secret);
  const passkey = decrypt(account.daraja_passkey);
  const shortcode = account.daraja_shortcode;
  const darajaType = account.daraja_type || 'paybill';
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

  if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
    console.error('Missing M-Pesa configuration for account:', args.accountId);
    return { success: false, message: 'M-Pesa is not configured for this account' };
  }

  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  try {
    // 3. Get Auth Token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const authRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!authRes.ok) {
      console.error('M-Pesa auth failed', await authRes.text());
      return { success: false, message: 'Payment gateway auth failed.' };
    }

    const { access_token } = await authRes.json();

    // 4. STK Push
    const timestamp = format(new Date(), 'yyyyMMddHHmmss');
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    let mpesaPhone = phoneNumber.replace(/\D/g, '');
    if (mpesaPhone.startsWith('0')) mpesaPhone = '254' + mpesaPhone.slice(1);
    if (mpesaPhone.startsWith('+')) mpesaPhone = mpesaPhone.slice(1);

    const webhookSecret = account.mpesa_webhook_secret;
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tuinnov8.ngrok.app'}/api/mpesa/webhook/${webhookSecret}`;

    // Paybill = CustomerPayBillOnline (CommandID = "CustomerPayBillOnline" or "CustomerBuyGoodsOnline")
    const transactionType = darajaType === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
    const partyB = shortcode;

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: transactionType,
        Amount: amount,
        PartyA: mpesaPhone,
        PartyB: partyB,
        PhoneNumber: mpesaPhone,
        CallBackURL: callbackUrl,
        AccountReference: product.name.slice(0, 12),
        TransactionDesc: `Pay for ${product.name}`,
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.errorCode) {
      console.error('M-Pesa STK Push failed:', stkData);
      return { success: false, message: stkData.errorMessage || 'STK Push Failed.' };
    }

    // 5. Create Order entry
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        product_id: productId,
        amount: amount,
        delivery_fee: deliveryFee || 0,
        delivery_address: deliveryAddress,
        status: 'pending',
        receipt_status: 'pending'
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Failed to create order record:', orderError);
      return { success: false, message: 'Internal error generating order.' };
    }

    // 6. Save to database
    const { error: dbError } = await supabaseAdmin
      .from('mpesa_transactions')
      .insert({
        user_id: userId,
        contact_id: contactId,
        account_id: accountId,
        order_id: order.id,
        amount: amount,
        phone_number: mpesaPhone,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        status: 'pending',
      });

    if (dbError) {
      console.error('Failed to save mpesa transaction locally:', dbError);
    }

    return { success: true };
  } catch (error) {
    console.error('M-Pesa execution error:', error);
    return { success: false, message: 'Internal error processing payment.' };
  }
}
