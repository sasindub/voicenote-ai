// Page 1 (PRD): /dashboard/inquiries
// Columns: Customer, Phone, Summary, Date

"use client";

import { useOrders } from "@/hooks/useOrders";
import { OrdersTable } from "@/components/OrdersTable";

export default function InquiriesPage() {
  const { orders, loading, error } = useOrders("INQUIRY");

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">Could not load: {error}</p>}
      <OrdersTable
        orders={orders}
        loading={loading}
        columns={["customer", "phone", "summary", "date"]}
        emptyText="No inquiries yet. New WhatsApp orders will appear here."
      />
    </div>
  );
}
