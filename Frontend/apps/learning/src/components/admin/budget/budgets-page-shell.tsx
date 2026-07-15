"use client";

import { useState } from "react";
import { TrainingBudgetsManager } from "@/components/admin/training-budgets-manager";
import { BudgetDashboard } from "./budget-dashboard";

export function BudgetsPageShell() {
  const [tab, setTab] = useState<"manage" | "dashboard">("manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { key: "manage" as const, label: "Manage" },
          { key: "dashboard" as const, label: "Dashboard" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "manage" ? <TrainingBudgetsManager /> : <BudgetDashboard />}
    </div>
  );
}
