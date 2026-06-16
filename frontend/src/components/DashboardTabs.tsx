// ────────────────────────────────────────────────────────────────
// DashboardTabs — the three tabs (PRD): Inquiries / Confirmed / Cancelled.
// Implemented as nav links so each is its own URL/page, with the active
// one highlighted via usePathname().
// ────────────────────────────────────────────────────────────────

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/inquiries", label: "Inquiries" },
  { href: "/dashboard/confirmed", label: "Confirmed" },
  { href: "/dashboard/cancelled", label: "Cancelled" },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-lg border bg-card p-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
