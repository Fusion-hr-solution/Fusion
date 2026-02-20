import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@repo/ui";
import { type Interview } from "@/types";
import { InterviewStatusBadge } from "./interview-status-badge";

interface InterviewCardProps {
  interview: Interview;
}

export function InterviewCard({ interview }: InterviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{interview.candidate}</CardTitle>
          <InterviewStatusBadge status={interview.status} />
        </div>
        <CardDescription>{interview.role}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Date: {interview.date}
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">View Details</Button>
        <Button size="sm" variant="outline">
          Reschedule
        </Button>
      </CardFooter>
    </Card>
  );
}
