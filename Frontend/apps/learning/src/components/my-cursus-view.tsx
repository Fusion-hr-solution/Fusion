"use client";

import { useMemo, useCallback } from "react";
import {
  Route,
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  Star,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  Progress,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getMyCursus } from "@/services/learning-service";
import type { MyCursus, MyCursusItem, CursusItemStatus } from "@/types";
import { CURSUS_STATUS_CONFIG } from "@/data/cursus-status-config";

function StatusBadge({ status }: { status: CursusItemStatus }) {
  const config = CURSUS_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function CursusItemCard({ item }: { item: MyCursusItem }) {
  return (
    <Card className="border-border/60 ey-animate-fade-up">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium truncate">{item.trainingTitle}</p>
              {item.isRequired && (
                <Badge variant="default" className="text-[10px] flex-shrink-0">Required</Badge>
              )}
              {item.isFromSharedServiceLine && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">Shared</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {item.trainingDescription}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                {item.credits} credit{item.credits !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.duration} min
              </span>
              <span className="capitalize">{item.trainingType}</span>
            </div>
          </div>
          <StatusBadge status={item.status} />
        </div>
        {item.status === "in-progress" && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{item.progressPercentage}%</span>
            </div>
            <Progress value={item.progressPercentage} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MyCursusView() {
  const fetchFn = useCallback(() => getMyCursus(), []);
  const { data: cursus, isLoading } = useApiQuery<MyCursus | null>(fetchFn, { enabled: true });

  const grouped = useMemo(() => {
    if (!cursus?.items) return { required: [], optional: [] };
    const sorted = cursus.items.slice().sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      required: sorted.filter((i) => i.isRequired),
      optional: sorted.filter((i) => !i.isRequired),
    };
  }, [cursus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading your cursus...
      </div>
    );
  }

  if (!cursus) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Route className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">No Cursus Available</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your profile has not been assigned a grade and service line yet.
          Contact your administrator to set up your learning curriculum.
        </p>
      </div>
    );
  }

  const { summary } = cursus;
  const completionPct = summary.totalCount > 0
    ? Math.round((summary.completedCount / summary.totalCount) * 100)
    : 0;

  return (
    <div className="space-y-6 ey-animate-fade-up">
      {/* Summary cards */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mon Cursus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personalized learning curriculum
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{completionPct}%</p>
              </div>
              <Star className="h-8 w-8 text-[var(--ey-blue-500)] opacity-60" />
            </div>
            <Progress value={completionPct} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-[var(--ey-green-500)]">
                  {summary.completedCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{summary.totalCount}
                  </span>
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[var(--ey-green-500)] opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-[var(--ey-blue-500)]">
                  {summary.inProgressCount}
                </p>
              </div>
              <Clock className="h-8 w-8 text-[var(--ey-blue-500)] opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Credits Earned</p>
                <p className="text-2xl font-bold">
                  {summary.requiredCreditsEarned}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{summary.requiredCreditsTotal}
                  </span>
                </p>
              </div>
              <Award className="h-8 w-8 text-[var(--ey-orange-500)] opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Required formations */}
      {grouped.required.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Required Formations
            <Badge variant="secondary" className="text-xs">{grouped.required.length}</Badge>
          </h2>
          <div className="space-y-3 ey-stagger-list">
            {grouped.required.map((item) => (
              <CursusItemCard key={item.mappingId} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Optional formations */}
      {grouped.optional.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Optional Formations
            <Badge variant="outline" className="text-xs">{grouped.optional.length}</Badge>
          </h2>
          <div className="space-y-3 ey-stagger-list">
            {grouped.optional.map((item) => (
              <CursusItemCard key={item.mappingId} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Remaining time */}
      {summary.estimatedRemainingMinutes > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Estimated remaining time: {Math.round(summary.estimatedRemainingMinutes / 60)}h {summary.estimatedRemainingMinutes % 60}min
        </p>
      )}
    </div>
  );
}
