"use client";

import { useTranslations } from "next-intl";
import { Label } from "@repo/ui";
import type { ArticleTemplateSection } from "@/types/admin";

interface ArticleSectionEditorProps {
  sections: ArticleTemplateSection[];
  sectionValues: Record<string, string>;
  onSectionChange: (sectionId: string, value: string) => void;
}

export function ArticleSectionEditor({
  sections,
  sectionValues,
  onSectionChange,
}: ArticleSectionEditorProps) {
  const t = useTranslations("adminChapters");
  return (
    <div className="space-y-4">
      {[...sections]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((section) => (
          <div key={section.id} className="space-y-2">
            <Label htmlFor={`section-${section.id}`}>{section.label}</Label>
            <textarea
              id={`section-${section.id}`}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={
                section.placeholder ||
                t("articleSection.placeholder", {
                  label: section.label.toLowerCase(),
                })
              }
              value={sectionValues[section.id] ?? ""}
              onChange={(e) => onSectionChange(section.id, e.target.value)}
            />
          </div>
        ))}
    </div>
  );
}
