"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { TransactionsCharts } from "@/components/dashboard/transactions-charts";
import { CreditCard, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function TransactionsDashboard() {
  const { account, accountRole, profileLoading } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (profileLoading) return;
    if (!account) {
      setLoading(false);
      return;
    }

    async function fetchTransactions() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("mpesa_transactions")
          .select(`
            id,
            amount,
            status,
            phone_number,
            checkout_request_id,
            receipt_number,
            created_at,
            contact_id,
            contacts (
              name
            )
          `)
          .eq("account_id", account?.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTransactions(data || []);
      } catch (err: any) {
        console.error("Failed to fetch transactions:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [account, profileLoading, supabase]);

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Double-check authorization inside the UI (RLS already enforces this at the data level)
  if (accountRole !== "admin" && accountRole !== "owner") {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/5 text-center">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-destructive mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm">
              You must be an account administrator to view transactions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-primary" />
          Transactions
        </h2>
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : (
        <>
          <TransactionsCharts transactions={transactions} />
          <TransactionsTable transactions={transactions} />
        </>
      )}
    </div>
  );
}
