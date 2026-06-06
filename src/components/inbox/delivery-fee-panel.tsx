"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface DeliveryFeePanelProps {
  contactId: string;
}

export function DeliveryFeePanel({ contactId }: DeliveryFeePanelProps) {
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [location, setLocation] = useState<string>("");
  const [fee, setFee] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    // Poll for pending fee sessions
    const fetchSession = async () => {
      const { data } = await supabase
        .from("ecommerce_checkouts")
        .select("id, delivery_location")
        .eq("contact_id", contactId)
        .eq("status", "pending_fee")
        .maybeSingle();

      if (data) {
        setCheckoutId(data.id);
        setLocation(data.delivery_location || "Unknown location");
      } else {
        setCheckoutId(null);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [contactId, supabase]);

  if (!checkoutId) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fee) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/ecommerce/set-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutId, fee: parseFloat(fee) })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Fee set successfully. The customer has been notified via WhatsApp.");
      setCheckoutId(null);
      setFee("");
    } catch (err: any) {
      toast.error(`Failed to set fee: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-4 space-y-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="bg-primary/20 p-2 rounded-full">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Pending Delivery Fee</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Customer requested delivery to: <span className="font-medium text-foreground">{location}</span>
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input 
          type="number"
          min="0"
          step="0.01"
          placeholder="Enter fee (KES)"
          value={fee}
          onChange={e => setFee(e.target.value)}
          required
          className="bg-background"
        />
        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Fee"}
        </Button>
      </form>
    </div>
  );
}
