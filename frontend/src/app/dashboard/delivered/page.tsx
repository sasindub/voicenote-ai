// /dashboard/delivered — orders marked Delivered (awaiting completion).
// Columns: Customer, Phone, Product, Address. Open one to "Mark Completed".

"use client";

import { useOrders } from "@/hooks/useOrders";
import { OrdersTable } from "@/components/OrdersTable";

export default function DeliveredPage() {
  const { orders, loading, error } = useOrders("DELIVERED");

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">Could not load: {error}</p>}
      <OrdersTable
        orders={orders}
        loading={loading}
        columns={["customer", "phone", "product", "address"]}
        emptyText="No delivered orders yet."
      />
    </div>
  );
}
