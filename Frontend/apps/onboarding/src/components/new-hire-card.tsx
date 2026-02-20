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
import { type NewHire } from "@/types";

const statusVariant: Record<NewHire["status"], "default" | "secondary" | "outline"> = {
  completed: "default",
  "in-progress": "secondary",
  "just-started": "outline",
};

const statusLabel: Record<NewHire["status"], string> = {
  completed: "Completed",
  "in-progress": "In Progress",
  "just-started": "Just Started",
};

interface NewHireCardProps {
  hire: NewHire;
}

export function NewHireCard({ hire }: NewHireCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{hire.name}</CardTitle>
          <Badge variant={statusVariant[hire.status]}>
            {statusLabel[hire.status]}
          </Badge>
        </div>
        <CardDescription>
          {hire.role} &middot; Start date: {hire.startDate}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Onboarding progress</span>
            <span className="font-medium">{hire.progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${hire.progress}%` }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">View Checklist</Button>
        <Button size="sm" variant="outline">
          Assign Buddy
        </Button>
      </CardFooter>
    </Card>
  );
}
