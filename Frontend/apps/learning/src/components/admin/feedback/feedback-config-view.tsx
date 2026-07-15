"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { getAdminCategories } from "@/services/admin-service";
import { FeedbackQuestionBuilder } from "./feedback-question-builder";

export function FeedbackConfigView() {
  const t = useTranslations("adminFeedback");
  const tCommon = useTranslations("common");
  const fetchCategories = useCallback(() => getAdminCategories(), []);
  const { data: categories, isLoading } = useApiQuery(fetchCategories);
  const [selected, setSelected] = useState(""); // "" = default form

  return (
    <div className="space-y-6 p-6">
      <PageBreadcrumb
        backHref="/admin/feedback"
        backLabel={tCommon("actions.back")}
        items={[
          { label: t("overview.title"), href: "/admin/feedback" },
          { label: t("config.title") },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("config.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("config.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fq-category" className="text-xs font-medium text-muted-foreground">
          {t("config.category")}
        </label>
        <select
          id="fq-category"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">{t("config.defaultForm")}</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* key={selected} remounts the builder per category so its dialog/draft state resets cleanly. */}
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <FeedbackQuestionBuilder key={selected} categoryId={selected || undefined} />
      )}
    </div>
  );
}
