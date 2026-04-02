import {
  CheckCircle2,
  Zap,
  Flame,
  Award,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import type { AchievementsCardProps } from "@/types/component-props";

export function AchievementsCard({ completedCount }: AchievementsCardProps) {
  const badges = [
    {
      name: "First Steps",
      description: "Complete your first training",
      unlocked: completedCount >= 1,
      icon: Zap,
    },
    {
      name: "Quick Learner",
      description: "Complete 3 trainings",
      unlocked: completedCount >= 3,
      icon: Flame,
    },
    {
      name: "Knowledge Seeker",
      description: "Complete 5 trainings",
      unlocked: completedCount >= 5,
      icon: Award,
    },
    {
      name: "Master Scholar",
      description: "Complete 10 trainings",
      unlocked: completedCount >= 10,
      icon: GraduationCap,
    },
  ];

  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
            <Award
              className="h-3.5 w-3.5 ey-text-accent"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">Achievements</h3>
        </div>

        <div className="space-y-3">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.name}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  badge.unlocked
                    ? "bg-[hsl(var(--ey-yellow))]/8"
                    : "bg-muted"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    badge.unlocked
                      ? "ey-bg-accent"
                      : "bg-muted"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      badge.unlocked
                        ? "text-muted-foreground"
                        : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-semibold ${
                      badge.unlocked
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {badge.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {badge.description}
                  </p>
                </div>
                {badge.unlocked && (
                  <CheckCircle2
                    className="h-4 w-4 text-[hsl(var(--ey-green-500))] flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
