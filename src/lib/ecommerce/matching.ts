import { createClient } from '@supabase/supabase-js';
import { sendInteractiveButtons } from "@/lib/whatsapp/meta-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MatchProductArgs {
  accountId: string;
  inboundText: string;
  contactId: string;
  phoneNumberId: string;
  accessToken: string;
  toPhone: string;
}

/**
 * Checks if the incoming text matches any product in the inventory.
 * If it does, sends a WhatsApp Interactive Message offering the product.
 * Returns true if a product was offered, false otherwise.
 */
export async function handleEcommerceInquiry(args: MatchProductArgs): Promise<boolean> {
  const { accountId, inboundText, phoneNumberId, accessToken, toPhone } = args;

  // Split inbound text into words to do a basic matching
  const queryWords = inboundText.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (queryWords.length === 0) return false;

  // Fetch active products for the account
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, description, price, currency, stock_quantity, image_url")
    .eq("account_id", accountId)
    .eq("is_active", true);

  if (error || !products || products.length === 0) {
    return false;
  }

  // Find the first product that has all query words matching its name or description
  // This is a naive fuzzy matcher.
  let bestMatch = null;
  let highestScore = 0;

  for (const product of products) {
    // If out of stock, skip
    if (product.stock_quantity <= 0) continue;

    const searchableText = `${product.name} ${product.description || ""}`.toLowerCase();
    
    let score = 0;
    for (const word of queryWords) {
      if (searchableText.includes(word)) {
        score++;
      }
    }

    // Must match at least 1 significant word, and prioritize name matches
    if (score > 0 && product.name.toLowerCase().includes(inboundText.toLowerCase())) {
        score += 10; // Exact/substring match in name gets a big boost
    }

    if (score > highestScore && score >= 1) {
      highestScore = score;
      bestMatch = product;
    }
  }

  if (!bestMatch) {
    return false;
  }

  // We found a match, send an interactive button
  const bodyText = `We have exactly what you're looking for!\n\n*${bestMatch.name}*\nPrice: ${bestMatch.currency} ${bestMatch.price}\n\n${bestMatch.description ? bestMatch.description : 'Available in stock.'}`;

  try {
    await sendInteractiveButtons({
      phoneNumberId,
      accessToken,
      to: toPhone,
      bodyText: bodyText,
      headerImage: bestMatch.image_url || undefined,
      footerText: "Tap below to buy via M-Pesa",
      buttons: [
        { id: `buy_product_${bestMatch.id}`, title: "Buy Now" }
      ]
    });
    return true; // We handled it
  } catch (err) {
    console.error("Failed to send ecommerce interactive message", err);
    return false;
  }
}
