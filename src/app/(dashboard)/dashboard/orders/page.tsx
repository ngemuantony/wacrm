import { Suspense } from "react";
import { OrdersTable } from "@/components/orders/orders-table";

export const metadata = {
  title: "Orders | Tuinnov8WaCRM",
  description: "View and manage your customer orders",
};

export default function OrdersPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
      </div>
      <div className="flex-1 space-y-4">
        <Suspense fallback={<div>Loading orders...</div>}>
          <OrdersTable />
        </Suspense>
      </div>
    </div>
  );
}
