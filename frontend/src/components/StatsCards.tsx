// ────────────────────────────────────────────────────────────────
// StatsCards — the top cards: counts for every status + re-order
// customers. Polls the backend via useStats().
// ────────────────────────────────────────────────────────────────

"use client";

import {
  MessageSquare,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Repeat,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStats } from "@/hooks/useOrders";

export function StatsCards() {
  const stats = useStats();

  const cards = [
    { label: "Inquiries", value: stats?.inquiry, icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Confirmed", value: stats?.confirmed, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "Delivered", value: stats?.delivered, icon: Truck, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Completed", value: stats?.completed, icon: PackageCheck, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Cancelled", value: stats?.cancelled, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Re-orders", value: stats?.reorders, icon: Repeat, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-full p-2.5 ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold">{c.value ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
