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
import { type JobOpening } from "@/types";

const statusVariant: Record<JobOpening["status"], "default" | "secondary" | "outline"> = {
  active: "default",
  "closing-soon": "secondary",
  closed: "outline",
};

const statusLabel: Record<JobOpening["status"], string> = {
  active: "Active",
  "closing-soon": "Closing Soon",
  closed: "Closed",
};

interface JobOpeningCardProps {
  opening: JobOpening;
}

export function JobOpeningCard({ opening }: JobOpeningCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{opening.title}</CardTitle>
          <Badge variant={statusVariant[opening.status]}>
            {statusLabel[opening.status]}
          </Badge>
        </div>
        <CardDescription>
          {opening.department} &middot; {opening.applicants} applicants
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full"
            style={{ width: `${Math.min((opening.applicants / 50) * 100, 100)}%` }}
          />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">View Applicants</Button>
        <Button size="sm" variant="outline">
          Edit Posting
        </Button>
      </CardFooter>
    </Card>
  );
}
