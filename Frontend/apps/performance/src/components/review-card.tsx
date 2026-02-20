import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Badge,
} from "@repo/ui";
import { type PerformanceReview } from "@/types";

const ratingVariant: Record<PerformanceReview["rating"], "default" | "secondary" | "outline"> = {
  outstanding: "default",
  "exceeds-expectations": "secondary",
  "meets-expectations": "outline",
  "needs-improvement": "outline",
};

const ratingLabel: Record<PerformanceReview["rating"], string> = {
  outstanding: "Outstanding",
  "exceeds-expectations": "Exceeds Expectations",
  "meets-expectations": "Meets Expectations",
  "needs-improvement": "Needs Improvement",
};

interface ReviewCardProps {
  review: PerformanceReview;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{review.employee}</CardTitle>
          <Badge variant={ratingVariant[review.rating]}>
            {ratingLabel[review.rating]}
          </Badge>
        </div>
        <CardDescription>
          {review.role} &middot; {review.period}
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        <Button size="sm">View Review</Button>
        <Button size="sm" variant="outline">
          Set Goals
        </Button>
      </CardFooter>
    </Card>
  );
}
