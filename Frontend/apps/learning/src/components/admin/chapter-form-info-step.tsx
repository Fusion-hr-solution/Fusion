import { Input, Label } from "@repo/ui";
import type { ChapterFormInfoStepProps } from "@/types/admin-props";

const CONTENT_TYPES = ["Article", "Video", "Document", "Interactive"];

export function ChapterFormInfoStep({
  title,
  onTitleChange,
  contentType,
  onContentTypeChange,
  orderIndex,
  onOrderIndexChange,
  fieldErrors = {},
}: ChapterFormInfoStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ch-title">Title *</Label>
        <Input
          id="ch-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Chapter title"
          className={fieldErrors.title ? "border-[hsl(var(--ey-red-500))]" : ""}
        />
        {fieldErrors.title && <p className="text-xs text-[hsl(var(--ey-red-500))]">{fieldErrors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ch-type">Content Type *</Label>
          <select
            id="ch-type"
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={contentType}
            onChange={(e) => onContentTypeChange(e.target.value)}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ch-order">Order Index</Label>
          <Input
            id="ch-order"
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => onOrderIndexChange(Number(e.target.value))}
            className={fieldErrors.orderIndex ? "border-[hsl(var(--ey-red-500))]" : ""}
          />
          {fieldErrors.orderIndex && <p className="text-xs text-[hsl(var(--ey-red-500))]">{fieldErrors.orderIndex}</p>}
        </div>
      </div>
    </div>
  );
}
