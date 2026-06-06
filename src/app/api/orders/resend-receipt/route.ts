import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Check account
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No active account' }, { status: 400 });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, product:products(*), contact:contacts(*)')
      .eq('id', orderId)
      .eq('account_id', profile.account_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'paid' && order.status !== 'delivered') {
      return NextResponse.json({ error: 'Cannot send receipt for unpaid order' }, { status: 400 });
    }

    // Fetch mpesa transaction to get receipt number
    const { data: tx } = await supabase
      .from('mpesa_transactions')
      .select('receipt_number')
      .eq('order_id', orderId)
      .single();

    const receiptNumber = tx?.receipt_number || 'N/A';

    // Fetch WhatsApp config
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', profile.account_id)
      .single();

    if (!config || config.status !== 'connected') {
      return NextResponse.json({ error: 'WhatsApp is not connected' }, { status: 400 });
    }

    const accessToken = decrypt(config.access_token);
    const textMessage = `*Payment Received! 🎉*\nWe've successfully received your M-Pesa payment of KES ${order.amount} for *${order.product?.name || 'Your Item'}*.\n\nReceipt: ${receiptNumber}\n${order.delivery_address ? `Delivery Address: ${order.delivery_address}\n` : ''}Thank you for your purchase!`;

    try {
      const result = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: order.contact.phone_number,
        text: textMessage
      });

      await supabase
        .from('orders')
        .update({ receipt_status: 'sent', receipt_message_id: result.messageId, receipt_error: null })
        .eq('id', order.id);

      return NextResponse.json({ success: true, messageId: result.messageId });
    } catch (err: any) {
      console.error('Failed to resend receipt', err);
      await supabase
        .from('orders')
        .update({ receipt_status: 'failed', receipt_error: err.message })
        .eq('id', order.id);

      return NextResponse.json({ error: err.message || 'Failed to send WhatsApp message' }, { status: 500 });
    }
  } catch (error) {
    console.error('API /orders/resend-receipt error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
