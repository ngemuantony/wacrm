import { createClient } from '@supabase/supabase-js';
import { sendInteractiveButtons, sendInteractiveList, sendTextMessage } from "@/lib/whatsapp/meta-api";
import { triggerMpesaCheckout } from './checkout';
import { handleEcommerceInquiry } from './matching';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProcessEcommerceArgs {
  accountId: string;
  contactId: string;
  phoneNumberId: string;
  accessToken: string;
  contactPhone: string;
  userId: string;
  message: any; // The meta message object
  interactiveReplyId: string | null;
  inboundText: string;
}

export async function processEcommerceFlow(args: ProcessEcommerceArgs): Promise<boolean> {
  const { accountId, contactId, phoneNumberId, accessToken, contactPhone, userId, message, interactiveReplyId, inboundText } = args;

  // 1. User tapped "Buy Now" on a product
  if (interactiveReplyId?.startsWith('buy_product_')) {
    const productId = interactiveReplyId.replace('buy_product_', '');
    
    // Clear any existing sessions
    await supabaseAdmin
      .from('ecommerce_checkouts')
      .delete()
      .eq('contact_id', contactId);

    // Create a new checkout session
    await supabaseAdmin
      .from('ecommerce_checkouts')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        product_id: productId,
        status: 'pending_location'
      });

    // Fetch delivery zones for this account
    const { data: zones } = await supabaseAdmin
      .from('delivery_zones')
      .select('id, name, fee')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('name');

    if (zones && zones.length > 0) {
      // Show Interactive List with zones + Custom Location
      const rows = zones.map(z => ({
        id: `zone_${z.id}`,
        title: z.name.substring(0, 24),
        description: `Delivery Fee: KES ${z.fee}`
      })).slice(0, 9); // Max 9 rows to leave room for Custom

      rows.push({
        id: 'zone_custom',
        title: 'Other Location',
        description: 'Enter your custom address'
      });

      await sendInteractiveList({
        phoneNumberId,
        accessToken,
        to: contactPhone,
        bodyText: "Where would you like this delivered? Pick a zone or choose 'Other Location'.",
        buttonLabel: "Select Location",
        sections: [{ title: "Delivery Zones", rows }],
        contextMessageId: message.id
      });
    } else {
      // Fallback: Just ask for location if no predefined zones
      await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: contactPhone,
        text: "Please reply with your delivery address or location details.",
        contextMessageId: message.id
      });
    }

    return true;
  }

  // 2. User selected a delivery zone from the list
  if (interactiveReplyId?.startsWith('zone_')) {
    const zoneId = interactiveReplyId.replace('zone_', '');
    
    const { data: session } = await supabaseAdmin
      .from('ecommerce_checkouts')
      .select('id, product_id')
      .eq('contact_id', contactId)
      .eq('status', 'pending_location')
      .maybeSingle();

    if (!session) return true; // Consume but do nothing if session lost

    if (zoneId === 'custom') {
      // They chose custom location. Just ask them to type it.
      await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: contactPhone,
        text: "Please reply with your custom delivery address.",
        contextMessageId: message.id
      });
      return true;
    }

    // They chose a specific zone
    const { data: zone } = await supabaseAdmin
      .from('delivery_zones')
      .select('name, fee')
      .eq('id', zoneId)
      .maybeSingle();

    if (zone) {
      // Advance to pending_number
      await supabaseAdmin
        .from('ecommerce_checkouts')
        .update({
          delivery_location: zone.name,
          delivery_fee: zone.fee,
          status: 'pending_number'
        })
        .eq('id', session.id);

      // Prompt for number
      await sendInteractiveButtons({
        phoneNumberId,
        accessToken,
        to: contactPhone,
        bodyText: `Great! Your delivery fee to ${zone.name} is KES ${zone.fee}.\n\nPlease reply with your M-Pesa phone number for payment, or tap below to use your current WhatsApp number.`,
        buttons: [
          { id: `checkout_wa_${session.product_id}`, title: "Use my WA number" }
        ],
        contextMessageId: message.id
      });
    }
    return true;
  }

  // 3. User clicked "Use my WA Number" for M-Pesa
  if (interactiveReplyId?.startsWith('checkout_wa_')) {
    const productId = interactiveReplyId.replace('checkout_wa_', '');
    
    const { data: session } = await supabaseAdmin
      .from('ecommerce_checkouts')
      .select('*')
      .eq('contact_id', contactId)
      .eq('status', 'pending_number')
      .maybeSingle();

    if (session) {
      // Trigger checkout with WA number
      const { success, message: mpesaMsg } = await triggerMpesaCheckout({
        accountId,
        productId,
        contactId,
        phoneNumber: contactPhone,
        userId,
        deliveryFee: session.delivery_fee || 0,
        deliveryAddress: session.delivery_location || undefined
      });

      await supabaseAdmin.from('ecommerce_checkouts').delete().eq('id', session.id);

      await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: contactPhone,
        text: success 
          ? "We've sent an M-Pesa payment prompt to your phone. Please enter your PIN to complete the purchase."
          : `Failed to initiate payment: ${mpesaMsg || 'Unknown error'}`,
        contextMessageId: message.id
      }).catch(err => console.error('Failed to send ecommerce mpesa followup', err));
    }
    return true;
  }

  // 4. User sent a text message during an active session
  if (message.type === 'text') {
    const { data: session } = await supabaseAdmin
      .from('ecommerce_checkouts')
      .select('*')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (session) {
      if (session.status === 'pending_location') {
        // Save the custom location
        await supabaseAdmin
          .from('ecommerce_checkouts')
          .update({
            delivery_location: inboundText,
            status: 'pending_fee'
          })
          .eq('id', session.id);

        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: contactPhone,
          text: "Thanks! Our team is calculating the delivery fee for your custom location. We will notify you shortly.",
          contextMessageId: message.id
        });
        return true;
      }
      
      if (session.status === 'pending_fee') {
        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: contactPhone,
          text: "Our team is still calculating your delivery fee. Please wait a moment.",
          contextMessageId: message.id
        });
        return true;
      }

      if (session.status === 'pending_number') {
        // They typed a phone number
        const { success, message: mpesaMsg } = await triggerMpesaCheckout({
          accountId,
          productId: session.product_id,
          contactId,
          phoneNumber: inboundText,
          userId,
          deliveryFee: session.delivery_fee || 0,
          deliveryAddress: session.delivery_location || undefined
        });

        await supabaseAdmin.from('ecommerce_checkouts').delete().eq('id', session.id);

        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: contactPhone,
          text: success 
            ? "We've sent an M-Pesa payment prompt to your specified phone number. Please enter your PIN to complete the purchase."
            : `Failed to initiate payment: ${mpesaMsg || 'Unknown error. Ensure the phone number format is correct.'}`,
          contextMessageId: message.id
        }).catch(err => console.error('Failed to send ecommerce mpesa followup', err));
        return true;
      }
    }

    // Not in checkout state, fall back to generic matching
    return await handleEcommerceInquiry({
      accountId,
      inboundText,
      contactId,
      phoneNumberId,
      accessToken,
      toPhone: contactPhone
    });
  }

  return false;
}
