// ────────────────────────────────────────────────────────────────
// OrdersTable — a reusable table for a list of orders. The columns differ
// per page (PRD), so the parent passes which columns to show. Clicking a
// row opens the OrderDetailDialog.
// ────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { OrderDetailDialog } from "@/components/OrderDetailDialog";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/types/order";

export type Column = "customer" | "phone" | "summary" | "product" | "address" | "date";

const HEADERS: Record<Column, string> = {
  customer: "Customer",
  phone: "Phone",
  summary: "Summary",
  product: "Product",
  address: "Address",
  date: "Date",
};

function cleanPhone(p: string) {
  return p.replace("whatsapp:", "");
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// The customer cell is special — it shows the name plus an unread dot and a
// "Returning" badge — so it returns JSX. Everything else returns a string.
function customerCell(order: Order) {
  const unread = (order.unreadCount || 0) > 0;
  return (
    <div className="flex items-center gap-2">
      {unread && (
        <span
          title="New customer messages"
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
        />
      )}
      <span className="font-medium">{order.customerName?.trim() || "—"}</span>
      {order.isReturningCustomer && (
        <Badge variant="returning" className="ml-1">
          Returning
        </Badge>
      )}
    </div>
  );
}

function cellValue(order: Order, col: Column): string {
  switch (col) {
    case "customer":
      return order.customerName?.trim() || "—";
    case "phone":
      return cleanPhone(order.phoneNumber);
    case "summary":
      return order.summary?.trim() || "—";
    case "product":
      return [order.product, order.size && `size ${order.size}`, order.color]
        .filter(Boolean)
        .join(", ") || "—";
    case "address":
      return order.address?.trim() || "—";
    case "date":
      return formatDate(order.updatedAt);
  }
}

export function OrdersTable({
  orders,
  columns,
  loading,
  emptyText,
}: {
  orders: Order[];
  columns: Column[];
  loading?: boolean;
  emptyText?: string;
}) {
  const [selected, setSelected] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);

  const openOrder = (o: Order) => {
    setSelected(o);
    setOpen(true);
  };

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{HEADERS[c]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  {emptyText || "No orders yet."}
                </TableCell>
              </TableRow>
            )}
            {orders.map((o) => (
              <TableRow
                key={o._id}
                className="cursor-pointer"
                onClick={() => openOrder(o)}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c}
                    className={c === "summary" || c === "address" ? "max-w-xs truncate" : ""}
                  >
                    {c === "customer" ? customerCell(o) : cellValue(o, c)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OrderDetailDialog order={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
