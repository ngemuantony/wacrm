"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Product } from "./product-modal";

interface ShareProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

interface Contact {
  id: string;
  name: string;
  phone_number: string;
}

export function ShareProductModal({ open, onOpenChange, product }: ShareProductModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      // In a real app we'd fetch via API or Supabase client
      // We will call the contacts API endpoint or Supabase
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.contacts) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleShare = async () => {
    if (!product || !selectedContactId) return;

    setSending(true);
    try {
      const res = await fetch("/api/inventory/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          contactId: selectedContactId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Product shared via WhatsApp!");
        onOpenChange(false);
        setSelectedContactId("");
      } else {
        toast.error(data.error || "Failed to share product");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Product</DialogTitle>
        </DialogHeader>
        
        {product && (
          <div className="py-4 space-y-4">
            <div className="bg-muted/30 p-3 rounded-lg border border-border">
              <p className="font-medium text-sm text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {product.currency} {product.price.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Select Contact to Share With</Label>
              {loadingContacts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading contacts...
                </div>
              ) : (
                <Select value={selectedContactId} onValueChange={(val) => setSelectedContactId(val || "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || c.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={sending || !selectedContactId} className="bg-[#25D366] text-foreground hover:bg-[#1DA851]">
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send WhatsApp Message
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
