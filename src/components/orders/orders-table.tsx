"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Order = {
  id: string;
  amount: number;
  status: string;
  delivery_address: string;
  receipt_status: string;
  created_at: string;
  contact: { name: string; phone_number: string };
  product: { name: string; currency: string };
};

export function OrdersTable() {
  const { accountId } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, contact:contacts(name, phone_number), product:products(name, currency)")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders");
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (accountId) fetchOrders();
  }, [accountId]);

  const handleResendReceipt = async (orderId: string) => {
    setResendingId(orderId);
    try {
      const res = await fetch("/api/orders/resend-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Receipt resent successfully!");
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to resend receipt");
      }
    } catch (err) {
      toast.error("An error occurred while resending");
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground text-sm">
          Track customer orders, delivery details, and WhatsApp receipt status.
        </p>
        <Button variant="outline" onClick={fetchOrders} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="rounded-md border bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-sm">
                    {format(new Date(order.created_at), "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.contact?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{order.contact?.phone_number}</div>
                  </TableCell>
                  <TableCell>{order.product?.name}</TableCell>
                  <TableCell>{order.product?.currency} {order.amount.toLocaleString()}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={order.delivery_address}>
                    {order.delivery_address || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {order.status === 'paid' && <Badge className="bg-green-500/10 text-green-500">Paid</Badge>}
                    {order.status === 'pending' && <Badge variant="secondary">Pending</Badge>}
                    {order.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
                    {order.status === 'delivered' && <Badge className="bg-blue-500/10 text-blue-500">Delivered</Badge>}
                  </TableCell>
                  <TableCell>
                    {order.receipt_status === 'sent' && <Badge className="bg-green-500/10 text-green-500">Sent</Badge>}
                    {order.receipt_status === 'pending' && <Badge variant="secondary">Pending</Badge>}
                    {order.receipt_status === 'failed' && <Badge variant="destructive">Failed</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {(order.status === 'paid' || order.status === 'delivered') && order.receipt_status !== 'sent' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleResendReceipt(order.id)}
                        disabled={resendingId === order.id}
                        title="Resend Receipt"
                      >
                        {resendingId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        ) : (
                          <Send className="h-4 w-4 text-blue-500" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
