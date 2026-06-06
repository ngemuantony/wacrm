import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No active account' }, { status: 400 });
    }

    const { data: config } = await supabase
      .from('survey_config')
      .select('*')
      .eq('account_id', profile.account_id)
      .maybeSingle();

    return NextResponse.json({ config: config || { is_active: false, question_text: '', delay_days: 3 } });
  } catch (error) {
    console.error('Failed to get survey config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, role')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.account_id || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { is_active, question_text, delay_days } = body;

    const { data, error } = await supabase
      .from('survey_config')
      .upsert({
        account_id: profile.account_id,
        is_active,
        question_text,
        delay_days,
        updated_at: new Date().toISOString()
      }, { onConflict: 'account_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('Failed to update survey config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
