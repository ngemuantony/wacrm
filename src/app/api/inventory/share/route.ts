import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendInteractiveButtons } from "@/lib/whatsapp/meta-api";
import { decrypt } from "@/lib/whatsapp/encryption";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, contactId } = await req.json();

    if (!productId || !contactId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Product
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Fetch Contact
    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // 3. Fetch WhatsApp Config
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("account_id", contact.account_id)
      .single();

    if (!config || config.status !== "connected") {
      return NextResponse.json({ error: "WhatsApp is not connected for this account" }, { status: 400 });
    }

    const accessToken = decrypt(config.access_token);

    // 4. Send Interactive Message via WhatsApp
    const res = await sendInteractiveButtons({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: contact.phone_number,
      bodyText: `*${product.name}*\n${product.description ? product.description + '\n\n' : ''}Price: ${product.currency} ${product.price.toLocaleString()}`,
      headerText: product.image_url ? undefined : "Featured Product",
      headerImage: product.image_url || undefined,
      footerText: "Reply to order or tap Buy Now",
      buttons: [
        {
          id: `checkout_wa_${product.id}`,
          title: "Buy Now"
        }
      ]
    });

    if (!res.messageId) {
      console.error("Failed to send WhatsApp message", res);
      return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 });
    }

    // 5. Store pending checkout session
    await supabase.from("ecommerce_checkouts").insert({
      contact_id: contact.id,
      product_id: product.id,
      status: "pending_location",
      delivery_fee: 0 // Optional: Could let the agent set this in the modal
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Share Product API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
