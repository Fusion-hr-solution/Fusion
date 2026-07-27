import type { Metadata } from "next";
import dynamic from "next/dynamic";

const SkillsConfigurationPage = dynamic(() =>
  import("@/components/evaluations/skills-configuration/skills-configuration-page").then((module) => module.SkillsConfigurationPage),
);

export const metadata: Metadata = { title: "Skills | EY Performance" };

export default function SkillsConfigurationRoute() {
  return <SkillsConfigurationPage />;
}
