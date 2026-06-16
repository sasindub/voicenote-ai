// ────────────────────────────────────────────────────────────────
// OrderDetailDialog — the "click an order" detail screen (PRD).
// Shows customer info, order details, status, and the COMPLETE
// conversation history (customer ↔ bot), with voice notes flagged.
// ────────────────────────────────────────────────────────────────

"use client";

import { Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import type { Order } from "@/types/order";

function cleanPhone(p: string) {
  return p.replace("whatsapp:", "");
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value && value.trim() ? value : "—"}</p>
    </div>
  );
}

export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>
              {order.customerName?.trim() ? order.customerName : "Unknown customer"}
            </DialogTitle>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">{cleanPhone(order.phoneNumber)}</p>
        </DialogHeader>

        {/* Customer + order details grid */}
        <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
          <Field label="Phone" value={cleanPhone(order.phoneNumber)} />
          <Field label="Email" value={order.email} />
          <Field label="Address" value={order.address} />
          <Field label="Product" value={order.product} />
          <Field label="Size" value={order.size} />
          <Field label="Color" value={order.color} />
          <Field label="Quantity" value={order.quantity} />
        </div>

        {order.summary?.trim() && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <span className="font-semibold">Summary: </span>
            {order.summary}
          </div>
        )}

        {/* Full conversation history */}
        <div>
          <p className="mb-2 text-sm font-semibold">Conversation history</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {order.messages.map((m, i) => {
              const isCustomer = m.sender === "customer";
              return (
                <div
                  key={i}
                  className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      isCustomer
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.messageType === "voice" && (
                      <span className="mr-1 inline-flex items-center gap-1 text-xs opacity-80">
                        <Mic className="h-3 w-3" /> voice
                      </span>
                    )}
                    {m.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
