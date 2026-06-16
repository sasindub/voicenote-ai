// ────────────────────────────────────────────────────────────────
// Dashboard layout — shared across all three pages. Renders the page
// header, the three stat cards, and the tab nav. The active page's
// table renders below via {children}.
// ────────────────────────────────────────────────────────────────

import { StatsCards } from "@/components/StatsCards";
import { DashboardTabs } from "@/components/DashboardTabs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">📦 WhatsApp Orders</h1>
        <p className="text-sm text-muted-foreground">
          Orders placed by customers over WhatsApp (text &amp; voice).
        </p>
      </header>

      <StatsCards />

      <DashboardTabs />

      <main>{children}</main>
    </div>
  );
}
