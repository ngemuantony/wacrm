import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/utils/encryption';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No active account found' }, { status: 400 });
    }

    const body = await req.json();
    const { 
      daraja_consumer_key, 
      daraja_consumer_secret, 
      daraja_passkey, 
      daraja_shortcode, 
      daraja_type,
      meta_rate_limit 
    } = body;

    // Build update payload
    const updatePayload: Record<string, any> = {};

    if (daraja_consumer_key !== undefined) updatePayload.daraja_consumer_key = encrypt(daraja_consumer_key);
    if (daraja_consumer_secret !== undefined) updatePayload.daraja_consumer_secret = encrypt(daraja_consumer_secret);
    if (daraja_passkey !== undefined) updatePayload.daraja_passkey = encrypt(daraja_passkey);
    if (daraja_shortcode !== undefined) updatePayload.daraja_shortcode = daraja_shortcode; // Usually not deeply secret, but can be encrypted. We'll leave it plaintext for debugging.
    if (daraja_type !== undefined) updatePayload.daraja_type = daraja_type;
    
    // Generate webhook secret if M-Pesa is being configured for the first time
    if (daraja_consumer_key || daraja_consumer_secret || daraja_passkey) {
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('mpesa_webhook_secret')
        .eq('id', profile.account_id)
        .single();
        
      if (!existingAccount?.mpesa_webhook_secret) {
        updatePayload.mpesa_webhook_secret = crypto.randomBytes(24).toString('hex');
      }
    }

    if (meta_rate_limit !== undefined) {
      updatePayload.meta_rate_limit = parseInt(meta_rate_limit, 10);
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from('accounts')
        .update(updatePayload)
        .eq('id', profile.account_id);

      if (error) {
        console.error('Failed to update integrations config:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /settings/integrations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No active account found' }, { status: 400 });
    }

    const { data: account, error } = await supabase
      .from('accounts')
      .select('daraja_consumer_key, daraja_consumer_secret, daraja_passkey, daraja_shortcode, daraja_type, mpesa_webhook_secret, meta_rate_limit')
      .eq('id', profile.account_id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // We do NOT return the decrypted secrets back to the frontend. We just return a boolean to show they are set.
    return NextResponse.json({
      hasConsumerKey: !!account.daraja_consumer_key,
      hasConsumerSecret: !!account.daraja_consumer_secret,
      hasPasskey: !!account.daraja_passkey,
      daraja_shortcode: account.daraja_shortcode || '',
      daraja_type: account.daraja_type || 'paybill',
      mpesa_webhook_secret: account.mpesa_webhook_secret || null,
      meta_rate_limit: account.meta_rate_limit || 250
    });
  } catch (error) {
    console.error('API /settings/integrations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
