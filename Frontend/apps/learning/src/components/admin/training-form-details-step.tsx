import { Input, Label, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TrainingFormDetailsStepProps } from "@/types/admin-props";
import type { CostType } from "@/types";

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
  costType,
  onCostTypeChange,
  sponsoringServiceLineId,
  onSponsoringServiceLineIdChange,
  serviceLines,
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

        {trainingType === "OnSite" && (
          <div className="space-y-2">
            <Label htmlFor="costType">Cost Type *</Label>
            <select
              id="costType"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={costType}
              onChange={(e) => onCostTypeChange(e.target.value as CostType)}
            >
              <option value="Internal">Internal (free)</option>
              <option value="External">External (paid)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              External trainings are delivered by a paid external trainer and draw from a service-line budget.
            </p>
          </div>
        )}

        {trainingType === "OnSite" && costType === "External" && (
          <div className="space-y-2">
            <Label htmlFor="sponsoringServiceLine">Sponsoring Service Line *</Label>
            <select
              id="sponsoringServiceLine"
              className={`flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${fieldErrors.sponsoringServiceLineId ? "border-destructive" : "border-input"}`}
              value={sponsoringServiceLineId}
              onChange={(e) => onSponsoringServiceLineIdChange(e.target.value)}
            >
              <option value="">Select a service line</option>
              {serviceLines.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.name} ({sl.code})
                </option>
              ))}
            </select>
            {fieldErrors.sponsoringServiceLineId && (
              <p className="text-xs text-destructive">{fieldErrors.sponsoringServiceLineId}</p>
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
