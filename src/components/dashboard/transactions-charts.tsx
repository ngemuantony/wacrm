"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Transaction {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface TransactionsChartsProps {
  transactions: Transaction[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981", // Emerald 500
  pending: "#f59e0b",   // Amber 500
  failed: "#ef4444",    // Red 500
};

export function TransactionsCharts({ transactions }: TransactionsChartsProps) {
  // Aggregate daily revenue (only completed)
  const dailyData = useMemo(() => {
    const dailyMap = new Map<string, number>();
    
    // Sort transactions by date ascending
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const t of sorted) {
      if (t.status === "completed") {
        const dateStr = format(parseISO(t.created_at), "MMM dd");
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + t.amount);
      }
    }

    return Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));
  }, [transactions]);

  // Aggregate status distribution
  const statusData = useMemo(() => {
    let completed = 0, pending = 0, failed = 0;
    for (const t of transactions) {
      if (t.status === "completed") completed++;
      else if (t.status === "pending") pending++;
      else failed++;
    }

    return [
      { name: "Completed", value: completed, color: STATUS_COLORS.completed },
      { name: "Pending", value: pending, color: STATUS_COLORS.pending },
      { name: "Failed", value: failed, color: STATUS_COLORS.failed },
    ].filter(d => d.value > 0);
  }, [transactions]);

  const totalRevenue = useMemo(() => 
    transactions.filter(t => t.status === "completed").reduce((sum, t) => sum + t.amount, 0),
  [transactions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>
            Total completed: KES {totalRevenue.toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No completed transactions to display
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: "#6b7280" }} 
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(value) => `KES ${value}`} 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    width={80}
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: any) => [`KES ${value}`, "Revenue"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>Transaction outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {statusData.length === 0 ? (
               <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                 No transactions found
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-4 mt-4">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name} ({s.value})
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
