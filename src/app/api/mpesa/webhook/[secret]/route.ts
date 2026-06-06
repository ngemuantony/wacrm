import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

// The webhook uses the service role key to bypass RLS since it's an unauthenticated callback
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string }> }
) {
  try {
    const { secret } = await params;
    
    // Validate secret exists and find the account
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('mpesa_webhook_secret', secret)
      .single();

    if (!account) {
      console.error('Invalid M-Pesa webhook secret used:', secret);
      // Return 200 anyway so M-Pesa stops retrying
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const body = await request.json()
    console.log('M-Pesa Webhook payload:', JSON.stringify(body))

    const stkCallback = body?.Body?.stkCallback
    if (!stkCallback) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback

    const isSuccess = ResultCode === 0
    let receiptNumber = null
    let amount = 0

    if (isSuccess && CallbackMetadata?.Item) {
      const receiptItem = CallbackMetadata.Item.find((item: any) => item.Name === 'MpesaReceiptNumber')
      if (receiptItem) receiptNumber = receiptItem.Value
      
      const amountItem = CallbackMetadata.Item.find((item: any) => item.Name === 'Amount')
      if (amountItem) amount = amountItem.Value
    }

    // 1. Update Transaction Status
    const { data: tx, error: txError } = await supabaseAdmin
      .from('mpesa_transactions')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        receipt_number: receiptNumber,
        result_desc: ResultDesc,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID)
      .select('*, contact:contacts(*), order:orders(*)')
      .single()

    if (txError || !tx) {
      console.error('Webhook: Transaction not found or update failed', txError)
      return NextResponse.json({ success: true }) // Always return success to Safaricom
    }

    // 2. Update Order Status
    if (tx.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({
          status: isSuccess ? 'paid' : 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', tx.order_id);
    }

    // 3. If successful, send an automated WhatsApp message to the contact
    if (isSuccess && tx.contact) {
      // Find the account's active whatsapp config
      const { data: config } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', tx.account_id)
        .single()

      if (config && config.status === 'connected') {
        const accessToken = decrypt(config.access_token)
        
        // Find or create conversation
        let conversationId = null
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .eq('contact_id', tx.contact.id)
          .single()
          
        if (conv) conversationId = conv.id

        // Fetch product name for receipt
        let productName = 'Your Item';
        if (tx.order?.product_id) {
           const { data: prod } = await supabaseAdmin.from('products').select('name').eq('id', tx.order.product_id).single();
           if (prod) productName = prod.name;
        }

        const textMessage = `*Payment Received! 🎉*\nWe've successfully received your M-Pesa payment of KES ${amount} for *${productName}*.\n\nReceipt: ${receiptNumber}\n${tx.order?.delivery_address ? `Delivery Address: ${tx.order.delivery_address}\n` : ''}Thank you for your purchase!`;

        try {
          const result = await sendTextMessage({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: tx.phone_number,
            text: textMessage
          })

          if (tx.order_id) {
             await supabaseAdmin.from('orders').update({ receipt_status: 'sent', receipt_message_id: result.messageId }).eq('id', tx.order_id);
          }

          if (conversationId) {
            await supabaseAdmin.from('messages').insert({
              conversation_id: conversationId,
              sender_type: 'bot',
              content_type: 'text',
              content_text: textMessage,
              message_id: result.messageId,
              status: 'sent',
            })
            
            await supabaseAdmin.from('conversations').update({
              last_message_text: textMessage,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq('id', conversationId)
          }
        } catch (err: any) {
          console.error('Failed to send receipt message', err);
          if (tx.order_id) {
             await supabaseAdmin.from('orders').update({ receipt_status: 'failed', receipt_error: err.message }).eq('id', tx.order_id);
          }
        }
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}
