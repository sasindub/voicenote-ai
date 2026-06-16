// Page 2 (PRD): /dashboard/confirmed
// Columns: Customer, Phone, Product, Address

"use client";

import { useOrders } from "@/hooks/useOrders";
import { OrdersTable } from "@/components/OrdersTable";

export default function ConfirmedPage() {
  const { orders, loading, error } = useOrders("CONFIRMED");

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">Could not load: {error}</p>}
      <OrdersTable
        orders={orders}
        loading={loading}
        columns={["customer", "phone", "product", "address"]}
        emptyText="No confirmed orders yet."
      />
    </div>
  );
}
