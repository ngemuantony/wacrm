import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';
import { decrypt } from '@/lib/whatsapp/encryption';

// This is a cron job, so it uses the service role key to access all accounts
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // In a real app, you'd secure this with an Authorization header (e.g. from Vercel Cron)
  // if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    // 1. Fetch active survey configurations
    const { data: configs, error: configError } = await supabaseAdmin
      .from('survey_config')
      .select('*')
      .eq('is_active', true);

    if (configError || !configs) {
      console.error('Failed to fetch survey configs', configError);
      return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
    }

    let surveysSent = 0;

    for (const config of configs) {
      // 2. Find completed orders for this account that are exactly `delay_days` old
      // We look at orders updated between `delay_days` ago and `delay_days + 1` ago
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - config.delay_days);
      const startOfDay = new Date(targetDate.setHours(0,0,0,0)).toISOString();
      const endOfDay = new Date(targetDate.setHours(23,59,59,999)).toISOString();

      const { data: eligibleOrders } = await supabaseAdmin
        .from('orders')
        .select('*, contact:contacts(*)')
        .eq('account_id', config.account_id)
        .eq('status', 'paid') // or 'delivered'
        .gte('updated_at', startOfDay)
        .lte('updated_at', endOfDay);

      if (!eligibleOrders || eligibleOrders.length === 0) continue;

      // Fetch WhatsApp config for this account
      const { data: waConfig } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', config.account_id)
        .single();

      if (!waConfig || waConfig.status !== 'connected') continue;
      const accessToken = decrypt(waConfig.access_token);

      for (const order of eligibleOrders) {
        // Check if we already sent a survey for this order
        const { data: existingSurvey } = await supabaseAdmin
          .from('survey_responses')
          .select('id')
          .eq('order_id', order.id)
          .maybeSingle();

        if (existingSurvey) continue;

        // Send the survey message
        try {
          const result = await sendTextMessage({
            phoneNumberId: waConfig.phone_number_id,
            accessToken,
            to: order.contact.phone_number,
            text: config.question_text
          });

          // Insert a "pending" or placeholder response so we don't send it again tomorrow
          await supabaseAdmin.from('survey_responses').insert({
            account_id: config.account_id,
            contact_id: order.contact_id,
            order_id: order.id,
            response_text: 'PENDING_RESPONSE'
          });

          // Log message to conversation
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('contact_id', order.contact_id)
            .single();

          if (conv) {
            await supabaseAdmin.from('messages').insert({
              conversation_id: conv.id,
              sender_type: 'bot',
              content_type: 'text',
              content_text: config.question_text,
              message_id: result.messageId,
              status: 'sent',
            });
            
            await supabaseAdmin.from('conversations').update({
              last_message_text: config.question_text,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq('id', conv.id);
          }

          surveysSent++;
        } catch (err) {
          console.error(`Failed to send survey to ${order.contact.phone_number}`, err);
        }
      }
    }

    return NextResponse.json({ success: true, surveysSent });
  } catch (error) {
    console.error('API /cron/surveys error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
