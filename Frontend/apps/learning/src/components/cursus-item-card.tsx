import { Award, Clock } from "lucide-react";
import { Badge, Card, CardContent, Progress } from "@repo/ui";
import type { MyCursusItem, CursusItemStatus } from "@/types";
import { CURSUS_STATUS_CONFIG } from "@/data/cursus-status-config";

function StatusBadge({ status }: { status: CursusItemStatus }) {
  const config = CURSUS_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" /> {config.label}
    </Badge>
  );
}

export function CursusItemCard({ item }: { item: MyCursusItem }) {
  return (
    <Card className="border-border/60 ey-animate-fade-up">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium truncate">{item.trainingTitle}</p>
              {item.isRequired && <Badge variant="default" className="text-[10px] flex-shrink-0">Required</Badge>}
              {item.isFromSharedServiceLine && <Badge variant="outline" className="text-[10px] flex-shrink-0">Shared</Badge>}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.trainingDescription}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {item.credits} credit{item.credits !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.duration} min</span>
              <span className="capitalize">{item.trainingType}</span>
            </div>
          </div>
          <StatusBadge status={item.status} />
        </div>
        {item.status === "in-progress" && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span><span>{item.progressPercentage}%</span>
            </div>
            <Progress value={item.progressPercentage} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
