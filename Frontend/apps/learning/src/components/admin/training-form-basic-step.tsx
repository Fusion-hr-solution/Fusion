import { Input, Label, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TrainingFormBasicStepProps } from "@/types/admin-props";
import type { TrainingType } from "@/types";

const BADGE_LEVELS = ["Bronze", "Silver", "Gold"];
const TRAINING_TYPES: { value: TrainingType; label: string; description: string }[] = [
  { value: "ELearning", label: "E-Learning", description: "Online self-paced training with chapters and content" },
  { value: "OnSite", label: "On-Site", description: "In-person training with PDF course materials" },
];

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
  trainingType,
  onTrainingTypeChange,
  fieldErrors = {},
}: TrainingFormBasicStepProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Training Type *</Label>
          <div className="grid grid-cols-2 gap-3">
            {TRAINING_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onTrainingTypeChange(t.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  trainingType === t.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-input hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

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
