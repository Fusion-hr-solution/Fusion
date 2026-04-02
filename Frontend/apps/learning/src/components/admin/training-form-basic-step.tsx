import { Input, Label, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TrainingFormBasicStepProps } from "@/types/admin-props";

const BADGE_LEVELS = ["Bronze", "Silver", "Gold"];

export function TrainingFormBasicStep({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  categoryId,
  onCategoryChange,
  categories,
  badgeLevel,
  onBadgeLevelChange,
  fieldErrors = {},
}: TrainingFormBasicStepProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Advanced Leadership Skills"
            className={fieldErrors.title ? "border-destructive" : ""}
          />
          {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            maxLength={2000}
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe the training program..."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <select
              id="category"
              required
              className={`flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${fieldErrors.categoryId ? "border-destructive" : "border-input"}`}
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="text-xs text-destructive">{fieldErrors.categoryId}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="badgeLevel">Badge Level *</Label>
            <select
              id="badgeLevel"
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={badgeLevel}
              onChange={(e) => onBadgeLevelChange(e.target.value)}
            >
              {BADGE_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
