import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@repo/ui";
import type { ChapterFormInfoStepProps } from "@/types/admin-props";

const CONTENT_TYPES = [
  { value: "Article", label: "Article" },
  { value: "Pdf", label: "PDF Document" },
  { value: "Video", label: "Video" },
  { value: "Exercise", label: "Exercise" },
];

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
          className={fieldErrors.title ? "border-destructive" : ""}
        />
        {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Content Type *</Label>
          <Select value={contentType} onValueChange={onContentTypeChange}>
            <SelectTrigger className={fieldErrors.contentType ? "border-destructive" : ""}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ch-order">Order Index</Label>
          <Input
            id="ch-order"
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => onOrderIndexChange(Number(e.target.value))}
            className={fieldErrors.orderIndex ? "border-destructive" : ""}
          />
          {fieldErrors.orderIndex && <p className="text-xs text-destructive">{fieldErrors.orderIndex}</p>}
        </div>
      </div>
    </div>
  );
}
