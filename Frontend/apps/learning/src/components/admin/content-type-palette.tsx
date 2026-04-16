"use client";

import { useDraggable } from "@dnd-kit/core";
import { CONTENT_TYPES, type ContentTypeConfig } from "@/data/chapter-templates";

interface PaletteItemProps {
  config: ContentTypeConfig;
}

function PaletteItem({ config }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${config.type}`,
    data: { source: "palette", contentType: config.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-background px-3 py-2.5 transition-all select-none hover:border-foreground/30 hover:shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-40 scale-95" : ""
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.colorClass}`}>
        <config.icon className={`h-4 w-4 ${config.iconColorClass}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{config.label}</p>
        <p className="text-[10px] leading-tight text-muted-foreground">{config.description}</p>
      </div>
    </div>
  );
}

export function ContentTypePalette() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Drag to add
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CONTENT_TYPES.map((config) => (
          <PaletteItem key={config.type} config={config} />
        ))}
      </div>
    </div>
  );
}
