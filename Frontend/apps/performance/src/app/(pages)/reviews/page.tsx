import { Suspense } from "react";
import { ReviewsWorkspace } from "@/features/performance/components/reviews/reviews-workspace";

export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsWorkspace />
    </Suspense>
  );
}
