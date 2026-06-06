import { Metadata } from "next";
import { Suspense } from "react";
import { InventoryTable } from "@/components/inventory/inventory-table";

export const metadata: Metadata = {
  title: "Inventory | Tuinnov8WaCRM",
  description: "Manage your products and inventory",
};

export default function InventoryPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Inventory</h2>
      </div>
      <div className="flex-1">
        <Suspense fallback={<div>Loading inventory...</div>}>
          <InventoryTable />
        </Suspense>
      </div>
    </div>
  );
}
