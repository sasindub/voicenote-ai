// Page 3 (PRD): /dashboard/cancelled
// Columns: Customer, Phone, Summary (acts as the "reason"/context)

"use client";

import { useOrders } from "@/hooks/useOrders";
import { OrdersTable } from "@/components/OrdersTable";

export default function CancelledPage() {
  const { orders, loading, error } = useOrders("CANCELLED");

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">Could not load: {error}</p>}
      <OrdersTable
        orders={orders}
        loading={loading}
        columns={["customer", "phone", "summary", "date"]}
        emptyText="No cancelled orders."
      />
    </div>
  );
}
