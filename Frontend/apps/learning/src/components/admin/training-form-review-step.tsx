import { CheckCircle2 } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TrainingFormReviewStepProps } from "@/types/admin-props";

export function TrainingFormReviewStep({
  title,
  description,
  categoryName,
  badgeLevel,
  credits,
  duration,
  isMandatory,
  trainingType,
  scheduledDate,
}: TrainingFormReviewStepProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--ey-green-500))]" />
          Review &amp; Submit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 space-y-3 text-sm">
          <Row label="Training Type" value={trainingType === "OnSite" ? "On-Site" : "E-Learning"} />
          <Row label="Title" value={title} />
          <Row label="Description" value={description || "—"} />
          <Row label="Category" value={categoryName} />
          <Row label="Badge Level" value={badgeLevel} />
          <Row label="Credits" value={String(credits)} />
          <Row label="Duration" value={duration || "—"} />
          {trainingType === "OnSite" && scheduledDate && (
            <Row label="Scheduled Date" value={new Date(scheduledDate).toLocaleString()} />
          )}
          <Row
            label="Mandatory"
            value={
              isMandatory ? (
                <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                  Yes
                </Badge>
              ) : (
                "No"
              )
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
