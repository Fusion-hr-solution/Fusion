import { Star, CheckCircle2, Clock, Award } from "lucide-react";
import { Card, CardContent, Progress } from "@repo/ui";
import type { MyCursus } from "@/types";

export function CursusSummaryCards({ summary, completionPct }: { summary: MyCursus["summary"]; completionPct: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Overall Progress</p><p className="text-2xl font-bold">{completionPct}%</p></div>
            <Star className="h-8 w-8 text-[hsl(var(--ey-blue-500))] opacity-60" />
          </div>
          <Progress value={completionPct} className="mt-2 h-1.5" />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-bold text-[hsl(var(--ey-green-500))]">{summary.completedCount}<span className="text-sm font-normal text-muted-foreground">/{summary.totalCount}</span></p></div>
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--ey-green-500))] opacity-60" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">In Progress</p><p className="text-2xl font-bold text-[hsl(var(--ey-blue-500))]">{summary.inProgressCount}</p></div>
            <Clock className="h-8 w-8 text-[hsl(var(--ey-blue-500))] opacity-60" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Credits Earned</p><p className="text-2xl font-bold">{summary.requiredCreditsEarned}<span className="text-sm font-normal text-muted-foreground">/{summary.requiredCreditsTotal}</span></p></div>
            <Award className="h-8 w-8 text-[hsl(var(--ey-orange-500))] opacity-60" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
