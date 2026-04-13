"use client";

import { CONTENT_TYPES, type ContentTypeConfig } from "@/data/chapter-templates";

interface ChapterTypePickerProps {
  onSelect: (type: string) => void;
}

export function ChapterTypePicker({ onSelect }: ChapterTypePickerProps) {
  return (
    <div>
      <p className="mb-4 text-[13px] font-semibold text-foreground">
        Choose a content type
      </p>
      <div className="grid grid-cols-2 gap-3">
        {CONTENT_TYPES.map((config: ContentTypeConfig) => (
          <button
            key={config.type}
            onClick={() => onSelect(config.type)}
            className="group flex items-start gap-3 rounded-2xl border-2 border-border bg-background p-4 text-left transition-all hover:border-foreground/30 hover:shadow-md active:scale-[0.98]"
          >
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${config.colorClass}`}>
              <config.icon className={`h-5 w-5 ${config.iconColorClass}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground">{config.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {config.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
