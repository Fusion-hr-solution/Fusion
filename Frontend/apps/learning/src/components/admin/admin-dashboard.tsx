"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TooltipProvider } from "@repo/ui";
import { PageHeader } from "../page-header";
import { ProgrammeSection } from "./programme-section";
import { AttendanceRatesSection } from "./attendance";

type AdminTab = "programme" | "attendance";

const TABS: { key: AdminTab; labelKey: string }[] = [
  { key: "programme", labelKey: "tabs.programme" },
  { key: "attendance", labelKey: "tabs.attendance" },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("programme");
  const t = useTranslations("adminDashboard");

  return (
    <TooltipProvider delayDuration={200}>
      <PageHeader
        moduleTitle={t("moduleTitle")}
        title={t("title")}
        description={t("description")}
      />

      <section className="px-8 py-6">
        <div
          role="tablist"
          aria-label={t("tabs.ariaLabel")}
          className="mb-6 flex items-center gap-1 border-b border-border"
        >
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === item.key
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        {tab === "programme" ? <ProgrammeSection /> : <AttendanceRatesSection />}
      </section>
    </TooltipProvider>
  );
}
