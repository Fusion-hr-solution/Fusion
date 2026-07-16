export interface PerformanceReview {
  id: string;
  employee: string;
  role: string;
  rating: "outstanding" | "exceeds-expectations" | "meets-expectations" | "needs-improvement";
  period: string;
}
