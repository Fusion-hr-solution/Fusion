"use client";

import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InstructorCardProps } from "@/types/component-props";

export function InstructorCard({ name, role }: InstructorCardProps) {
  const t = useTranslations("trainingDetail.instructor");
  return (
    <div
      className="ey-animate-fade-up rounded-2xl border border-border/50 bg-card p-6"
      style={{ animationDelay: "200ms" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <User
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <h3 className="text-sm font-bold text-foreground">
          {t("title")}
        </h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ey-bg-dark text-base font-semibold text-white ring-2 ring-border">
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {role}
          </p>
        </div>
      </div>
    </div>
  );
}
