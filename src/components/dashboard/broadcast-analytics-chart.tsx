"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Radio } from 'lucide-react';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

interface BroadcastMetricsChartProps {
  data: any[] | null;
  loading: boolean;
}

export function BroadcastAnalyticsChart({ data, loading }: BroadcastMetricsChartProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-lg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Broadcast Analytics</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Performance of recent broadcasts</p>
        </div>
      </header>

      <div className="p-5 flex-1 min-h-[240px]">
        {loading || !data ? (
          <Skeleton className="h-[240px] w-full" />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No broadcast data"
            hint="Send a broadcast to see analytics here."
          />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#f8fafc' }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSent)" />
              <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDelivered)" />
              <Area type="monotone" dataKey="read" name="Read" stroke="#10b981" fillOpacity={1} fill="url(#colorRead)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <footer className="flex items-center gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          Sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
          Delivered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Read
        </span>
      </footer>
    </section>
  );
}
