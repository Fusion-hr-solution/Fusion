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
import { type Course } from "@/types";

const levelVariant: Record<Course["level"], "default" | "secondary" | "outline"> = {
  beginner: "secondary",
  intermediate: "default",
  advanced: "outline",
};

const levelLabel: Record<Course["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge variant={levelVariant[course.level]}>
            {levelLabel[course.level]}
          </Badge>
          <span className="text-xs text-muted-foreground">{course.duration}</span>
        </div>
        <CardTitle className="text-lg">{course.title}</CardTitle>
        <CardDescription>{course.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
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
            ? "Start Course"
            : course.progress === 100
              ? "Review"
              : "Continue"}
        </Button>
      </CardFooter>
    </Card>
  );
}
