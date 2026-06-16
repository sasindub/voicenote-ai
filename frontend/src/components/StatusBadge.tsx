import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types/order";

const MAP: Record<
  OrderStatus,
  { label: string; variant: "inquiry" | "confirmed" | "delivered" | "completed" | "cancelled" }
> = {
  INQUIRY: { label: "Inquiry", variant: "inquiry" },
  CONFIRMED: { label: "Confirmed", variant: "confirmed" },
  DELIVERED: { label: "Delivered", variant: "delivered" },
  COMPLETED: { label: "Completed", variant: "completed" },
  CANCELLED: { label: "Cancelled", variant: "cancelled" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
