"use client";

import { useState, useCallback, useEffect } from "react";
import { useApiQuery } from "@repo/api/react";
import { Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@repo/ui";
import { getArticleTemplates } from "@/services/admin-service";
import type { ArticleTemplate } from "@/types/admin";

interface ArticleEditorProps {
  textContent: string;
  onTextContentChange: (value: string) => void;
}

export function ArticleEditor({ textContent, onTextContentChange }: ArticleEditorProps) {
  const { data: templates, isLoading } = useApiQuery(() => getArticleTemplates());

  const parsed = safeParse(textContent);
  const [selectedTemplate, setSelectedTemplate] = useState<ArticleTemplate | null>(null);
  const [sectionValues, setSectionValues] = useState<Record<string, string>>(() => {
    if (!parsed?.sections) return {};
    if (Array.isArray(parsed.sections)) {
      return Object.fromEntries(parsed.sections.map((s: { label: string; content: string }) => [s.label, s.content]));
    }
    return {};
  });

  // Auto-select template once loaded
  useEffect(() => {
    if (!templates || templates.length === 0 || selectedTemplate) return;
    const target =
      (parsed?.templateName && templates.find((t) => t.name === parsed.templateName)) ||
      templates.find((t) => t.name === "Standard Article") ||
      templates[0];
    if (target) {
      setSelectedTemplate(target);
      // Remap label-keyed values to section-ID keys
      setSectionValues((prev) => {
        const remapped: Record<string, string> = {};
        for (const s of target.sections) {
          remapped[s.id] = prev[s.label] ?? prev[s.id] ?? "";
        }
        return remapped;
      });
      // If there's no existing content, serialize the empty template
      if (!textContent) {
        const sections = [...target.sections]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((s) => ({ label: s.label, content: "" }));
        onTextContentChange(JSON.stringify({ templateName: target.name, sections }));
      }
    }
  }, [templates, selectedTemplate, parsed?.templateName, textContent, onTextContentChange]);

  const handleTemplateChange = useCallback((templateId: string) => {
    const template = templates?.find((t) => t.id === templateId) ?? null;
    if (!template) return;
    setSelectedTemplate(template);
    setSectionValues({});
    const sections = [...template.sections]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((s) => ({ label: s.label, content: "" }));
    onTextContentChange(JSON.stringify({ templateName: template.name, sections }));
  }, [templates, onTextContentChange]);

  const handleSectionChange = useCallback((sectionId: string, value: string) => {
    setSectionValues((prev) => {
      const next = { ...prev, [sectionId]: value };
      if (selectedTemplate) {
        const sections = [...selectedTemplate.sections]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((s) => ({ label: s.label, content: next[s.id] ?? "" }));
        onTextContentChange(JSON.stringify({ templateName: selectedTemplate.name, sections }));
      }
      return next;
    });
  }, [selectedTemplate, onTextContentChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[13px] font-semibold">Article Template</Label>
        <Select
          value={selectedTemplate?.id ?? ""}
          onValueChange={handleTemplateChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Loading templates..." : "Select a template"} />
          </SelectTrigger>
          <SelectContent>
            {(templates ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTemplate && (
          <p className="text-[11px] text-muted-foreground">{selectedTemplate.description}</p>
        )}
      </div>

      {selectedTemplate && (
        <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
          {[...selectedTemplate.sections]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((section) => (
              <div key={section.id} className="space-y-1.5">
                <Label className="text-[12px] font-semibold">{section.label}</Label>
                <textarea
                  rows={4}
                  value={sectionValues[section.id] ?? ""}
                  onChange={(e) => handleSectionChange(section.id, e.target.value)}
                  placeholder={section.placeholder || `Enter ${section.label.toLowerCase()}...`}
                  className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function safeParse(json: string) {
  try { return JSON.parse(json); }
  catch { return null; }
}
