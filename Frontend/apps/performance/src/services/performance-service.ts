import { type PerformanceReview } from "@/types";

const MOCK_REVIEWS: PerformanceReview[] = [
  {
    id: "1",
    employee: "Sarah Chen",
    role: "Product Manager",
    rating: "exceeds-expectations",
    period: "Q4 2025",
  },
  {
    id: "2",
    employee: "James Wilson",
    role: "Software Engineer",
    rating: "meets-expectations",
    period: "Q4 2025",
  },
  {
    id: "3",
    employee: "Maria Garcia",
    role: "Data Analyst",
    rating: "outstanding",
    period: "Q4 2025",
  },
];

export async function getPerformanceReviews(): Promise<PerformanceReview[]> {
  // TODO: Replace with actual API call
  return MOCK_REVIEWS;
}
