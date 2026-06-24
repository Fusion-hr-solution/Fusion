"use client";

import { useDraggable } from "@dnd-kit/core";
import { Layers } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@repo/ui";
import { CONTENT_TYPES, type ContentTypeConfig } from "@/data/chapter-templates";

/* ── Draggable palette card ── */

function DraggableBlock({ config }: { config: ContentTypeConfig }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${config.type}`,
    data: { source: "palette", contentType: config.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-3 rounded-xl border-2 border-dashed border-border bg-background p-3 transition-all select-none hover:border-foreground/25 hover:shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-30 scale-95" : ""
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.colorClass}`}
      >
        <config.icon className={`h-4 w-4 ${config.iconColorClass}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground leading-tight">
          {config.label}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
          {config.description}
        </p>
      </div>
    </div>
  );
}

/* ── Sidebar ── */

interface BuilderSidebarProps {
  layout: string;
  onLayoutChange: (layout: string) => void;
}

export function BuilderSidebar({ layout, onLayoutChange }: BuilderSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-6 border-r border-border bg-background p-5">
      {/* Layout selector */}
      <div className="space-y-2">
        <label
          htmlFor="builder-layout"
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Layout
        </label>
        <Select value={layout} onValueChange={onLayoutChange}>
          <SelectTrigger id="builder-layout" aria-label="Layout" className="h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SingleContent">Single Content</SelectItem>
            <SelectItem value="SplitLayout">Split Layout</SelectItem>
            <SelectItem value="MultiSection">Multi-Section</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Block palette */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Content Blocks
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Drag a block into the canvas to add it.
        </p>
        <div className="space-y-2 pt-1">
          {CONTENT_TYPES.map((config) => (
            <DraggableBlock key={config.type} config={config} />
          ))}
        </div>
      </div>
    </aside>
  );
}
