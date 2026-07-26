import type { Metadata } from "next";
import { SkillsConfigurationPage } from "@/components/evaluations/skills-configuration/skills-configuration-page";

export const metadata: Metadata = { title: "Skills | EY Performance" };

export default function SkillsConfigurationRoute() {
  return <SkillsConfigurationPage />;
}
