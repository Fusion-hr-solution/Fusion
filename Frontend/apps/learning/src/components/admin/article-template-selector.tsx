"use client";

import { useEffect } from "react";
import { useApiQuery } from "@repo/api/react";
import { Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@repo/ui";
import { getArticleTemplates } from "@/services/admin-service";
import type { ArticleTemplate } from "@/types/admin";

interface ArticleTemplateSelectorProps {
  selectedTemplateId: string;
  onTemplateChange: (template: ArticleTemplate | null) => void;
  /** When editing, pass the stored template name to restore the correct template. */
  initialTemplateName?: string;
}

export function ArticleTemplateSelector({ selectedTemplateId, onTemplateChange, initialTemplateName }: ArticleTemplateSelectorProps) {
  const { data: templates, isLoading } = useApiQuery(() => getArticleTemplates());

  // Auto-select template when templates load and nothing is selected yet.
  // When editing, prefer the stored templateName; otherwise default to "Standard Article".
  useEffect(() => {
    if (!templates || templates.length === 0 || selectedTemplateId) return;
    const target =
      (initialTemplateName && templates.find((t) => t.name === initialTemplateName)) ||
      templates.find((t) => t.name === "Standard Article") ||
      templates[0];
    if (target) onTemplateChange(target);
  }, [templates, selectedTemplateId, initialTemplateName, onTemplateChange]);

  function handleChange(templateId: string) {
    const template = templates?.find((t) => t.id === templateId) ?? null;
    onTemplateChange(template);
  }

  return (
    <div className="space-y-2">
      <Label>Article Template</Label>
      <Select value={selectedTemplateId} onValueChange={handleChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading templates..." : "Select a template"} />
        </SelectTrigger>
        <SelectContent>
          {(templates ?? []).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {templates && selectedTemplateId && (
        <p className="text-xs text-muted-foreground">
          {templates.find((t) => t.id === selectedTemplateId)?.description}
        </p>
      )}
    </div>
  );
}
