// /dashboard/completed — fully completed (closed) orders.
// Columns: Customer, Phone, Product, Date.

"use client";

import { useOrders } from "@/hooks/useOrders";
import { OrdersTable } from "@/components/OrdersTable";

export default function CompletedPage() {
  const { orders, loading, error } = useOrders("COMPLETED");

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">Could not load: {error}</p>}
      <OrdersTable
        orders={orders}
        loading={loading}
        columns={["customer", "phone", "product", "date"]}
        emptyText="No completed orders yet."
      />
    </div>
  );
}
