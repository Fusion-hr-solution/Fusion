"use client";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from "@repo/ui";
import { useTranslations } from "next-intl";
import type { CourseCardProps } from "@/types/component-props";
import { LEVEL_VARIANT } from "@/data/level-config";

export function CourseCard({ course }: CourseCardProps) {
  const t = useTranslations("catalog.courseCard");
  const tCommon = useTranslations("common");
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge variant={LEVEL_VARIANT[course.level]}>
            {tCommon(`level.${course.level}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {course.duration}
          </span>
        </div>
        <CardTitle className="text-lg">{course.title}</CardTitle>
        <CardDescription>{course.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t("progress")}</span>
            <span className="font-medium">{course.progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={course.progress === 100 ? "secondary" : "default"}
        >
          {course.progress === 0
            ? t("start")
            : course.progress === 100
              ? tCommon("statusAction.completed")
              : tCommon("statusAction.in-progress")}
        </Button>
      </CardFooter>
    </Card>
  );
}
