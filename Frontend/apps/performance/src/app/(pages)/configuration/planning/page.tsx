import type { Metadata } from "next";
import { ObjectivePlanningConfigurationPage } from "@/components/objective-planning/objective-planning-configuration-page";

export const metadata: Metadata = {
  title: "Objective Planning Configuration | EY Performance",
};

export default function PlanningRulesPage() {
  return <ObjectivePlanningConfigurationPage />;
}
