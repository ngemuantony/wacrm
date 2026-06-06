import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: "No active account" }, { status: 400 });
    }

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, name, phone_number')
      .eq('account_id', profile.account_id)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
    }

    return NextResponse.json({ contacts });
  } catch (err: any) {
    console.error("Contacts API error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
