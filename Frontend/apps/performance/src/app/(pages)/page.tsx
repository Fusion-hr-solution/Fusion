import { ReviewCard, StatCard } from "@/components";
import { getPerformanceReviews } from "@/services/performance-service";

export default async function PerformancePage() {
  const reviews = await getPerformanceReviews();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Performance Management</h1>
        <p className="mt-2 text-muted-foreground">
          Track employee performance reviews, goals, and development plans.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Total Reviews" value="128" />
        <StatCard label="Pending Reviews" value="24" />
        <StatCard label="Avg Rating" value="4.2 / 5" />
      </div>

      <h2 className="text-xl font-semibold mb-4">Recent Performance Reviews</h2>
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
