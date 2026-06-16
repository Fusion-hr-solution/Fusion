"use client";

import { useState } from "react";
import { TooltipProvider } from "@repo/ui";
import { PageHeader } from "../page-header";
import { ProgrammeSection } from "./programme-section";
import { AttendanceRatesSection } from "./attendance";

type AdminTab = "programme" | "attendance";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "programme", label: "Programme Matrix" },
  { key: "attendance", label: "Attendance" },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("programme");

  return (
    <TooltipProvider delayDuration={200}>
      <PageHeader
        moduleTitle="Administration"
        title="Learning analytics"
        description="Curriculum completion by grade and service line, and in-person attendance across sessions."
      />

      <section className="px-8 py-6">
        <div role="tablist" aria-label="Admin dashboards" className="mb-6 flex items-center gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
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

        {tab === "programme" ? <ProgrammeSection /> : <AttendanceRatesSection />}
      </section>
    </TooltipProvider>
  );
}
