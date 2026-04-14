import { Input, Label, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TrainingFormDetailsStepProps } from "@/types/admin-props";

export function TrainingFormDetailsStep({
  credits,
  onCreditsChange,
  duration,
  onDurationChange,
  isMandatory,
  onMandatoryChange,
  trainingType,
  scheduledDate,
  onScheduledDateChange,
  fieldErrors = {},
}: TrainingFormDetailsStepProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="credits">Credits</Label>
            <Input
              id="credits"
              type="number"
              min={0}
              max={1000}
              value={credits}
              onChange={(e) => onCreditsChange(Number(e.target.value))}
              className={fieldErrors.credits ? "border-destructive" : ""}
            />
            {fieldErrors.credits && <p className="text-xs text-destructive">{fieldErrors.credits}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Input
              id="duration"
              maxLength={50}
              value={duration}
              onChange={(e) => onDurationChange(e.target.value)}
              placeholder="e.g. 4 hours"
            />
          </div>
        </div>

        {trainingType === "OnSite" && (
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Scheduled Date & Time *</Label>
            <Input
              id="scheduledDate"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => onScheduledDateChange(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className={fieldErrors.scheduledDate ? "border-destructive" : ""}
            />
            {fieldErrors.scheduledDate && <p className="text-xs text-destructive">{fieldErrors.scheduledDate}</p>}
            {!fieldErrors.scheduledDate && scheduledDate && new Date(scheduledDate) <= new Date() && (
              <p className="text-xs text-destructive">Scheduled date must be in the future</p>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isMandatory}
            onChange={(e) => onMandatoryChange(e.target.checked)}
            className="rounded border-border"
          />
          Mark as mandatory training
        </label>
      </CardContent>
    </Card>
  );
}
