import { useCallback } from "react";
import { useCompanyValues } from "@repo/api/query";
import { cn } from "@repo/ds";

/**
 * Company values (active competencies) keep one identity hue each, wherever they appear: the chip on praise and
 * feedback, the "what we celebrate" bars, the composer's choices. Hues follow the catalogue's order (by name), so a
 * catalogue of five never repeats one; an archived value falls back to a hue from its id. Until the catalogue is known
 * a value is neutral (tone 0), so a hue never shows and then changes.
 */
export type ValueTone = 0 | 1 | 2 | 3 | 4 | 5;

export function valueTone(id: string, catalogue?: readonly { id: string }[]): ValueTone {
  if (!catalogue) return 0;
  const index = catalogue.findIndex((value) => value.id === id);
  if (index >= 0) return ((index % 5) + 1) as ValueTone;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 5) + 1) as ValueTone;
}

/** The tone of any value, read against the company's catalogue. */
export function useValueTones(): (id: string) => ValueTone {
  const values = useCompanyValues();
  return useCallback((id: string) => valueTone(id, values.data), [values.data]);
}

/** Full class names per tone, so Tailwind sees every one. */
export const VALUE_TONE: Record<ValueTone, { text: string; chip: string; fill: string; selected: string }> = {
  0: { text: "text-muted-foreground", chip: "bg-inlay text-muted-foreground border-border", fill: "bg-muted-foreground/40", selected: "bg-inlay border-border text-foreground" },
  1: { text: "text-identity-1", chip: "bg-identity-1/12 text-identity-1 border-identity-1/30", fill: "bg-identity-1", selected: "bg-identity-1/14 border-identity-1/45 text-identity-1" },
  2: { text: "text-identity-2", chip: "bg-identity-2/12 text-identity-2 border-identity-2/30", fill: "bg-identity-2", selected: "bg-identity-2/14 border-identity-2/45 text-identity-2" },
  3: { text: "text-identity-3", chip: "bg-identity-3/12 text-identity-3 border-identity-3/30", fill: "bg-identity-3", selected: "bg-identity-3/14 border-identity-3/45 text-identity-3" },
  4: { text: "text-identity-4", chip: "bg-identity-4/12 text-identity-4 border-identity-4/30", fill: "bg-identity-4", selected: "bg-identity-4/14 border-identity-4/45 text-identity-4" },
  5: { text: "text-identity-5", chip: "bg-identity-5/12 text-identity-5 border-identity-5/30", fill: "bg-identity-5", selected: "bg-identity-5/14 border-identity-5/45 text-identity-5" },
};

export function ValueChip({ value, className }: { value: { id: string; name: string }; className?: string }) {
  const toneOf = useValueTones();
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center truncate rounded-control-sm border px-2 type-meta font-medium",
        VALUE_TONE[toneOf(value.id)].chip,
        className,
      )}
    >
      {value.name}
    </span>
  );
}

/** The value's dot, for legends and choices where the name sits beside it. */
export function ValueDot({ id, className }: { id: string; className?: string }) {
  const toneOf = useValueTones();
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", VALUE_TONE[toneOf(id)].fill, className)} />;
}
