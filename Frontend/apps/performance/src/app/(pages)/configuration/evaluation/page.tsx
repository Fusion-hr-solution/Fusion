import type { Metadata } from "next";
import { EvaluationSetupPage } from "@/components/evaluations/evaluation-configuration-page";

export const metadata: Metadata = { title: "Evaluation setup | EY Performance" };

export default function EvaluationSetupRoute() {
  return <EvaluationSetupPage />;
}
