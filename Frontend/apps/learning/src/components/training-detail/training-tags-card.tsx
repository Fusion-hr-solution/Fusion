"use client";

import { Badge } from "@repo/ui";
import { useTranslations } from "next-intl";

export function TrainingTagsCard({ tags }: { tags: string[] }) {
  const t = useTranslations("trainingDetail");
  return (
    <div
      className="ey-animate-fade-up rounded-2xl border border-border/50 bg-card p-6"
      style={{ animationDelay: "250ms" }}
    >
      <h3 className="mb-3 text-sm font-bold text-foreground">
        {t("topics")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="rounded-full text-xs font-normal transition-colors hover:bg-muted"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
