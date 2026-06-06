import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendInteractiveButtons } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { checkoutId, fee } = await req.json();

    if (!checkoutId || typeof fee !== 'number') {
      return NextResponse.json({ error: 'Missing checkoutId or fee' }, { status: 400 });
    }

    // Get session
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('ecommerce_checkouts')
      .select('*, contacts(phone)')
      .eq('id', checkoutId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
    }

    // Update session
    const { error: updateErr } = await supabaseAdmin
      .from('ecommerce_checkouts')
      .update({
        delivery_fee: fee,
        status: 'pending_number'
      })
      .eq('id', checkoutId);

    if (updateErr) throw updateErr;

    // Get WhatsApp Config for the account
    const { data: config } = await supabaseAdmin
      .from('whatsapp_configs')
      .select('phone_number_id, access_token')
      .eq('account_id', session.account_id)
      .single();

    if (config) {
      const accessToken = decrypt(config.access_token);
      
      await sendInteractiveButtons({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: session.contacts.phone,
        bodyText: `Great news! We've calculated your delivery fee to ${session.delivery_location}: KES ${fee}.\n\nPlease reply with your M-Pesa phone number for payment, or tap below to use your current WhatsApp number.`,
        buttons: [
          { id: `checkout_wa_${session.product_id}`, title: "Use my WA number" }
        ]
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error setting delivery fee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
