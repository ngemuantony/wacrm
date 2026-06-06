import { DeliveryZones } from "@/components/inventory/delivery-zones";

export const metadata = {
  title: "Delivery Zones | Tuinnov8WaCRM",
  description: "Manage default delivery locations and fees",
};

export default function DeliveryZonesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Delivery Zones</h2>
      </div>
      <div className="mx-auto max-w-4xl">
        <DeliveryZones />
      </div>
    </div>
  );
}
