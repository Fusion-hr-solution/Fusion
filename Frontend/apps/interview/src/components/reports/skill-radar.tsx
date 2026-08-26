"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend as RechartsLegend,
  Tooltip,
} from "recharts";
import type { CandidateReportSkill } from "@/types";

/**
 * Candidate-vs-cohort radar. Default-exported so the container can `next/dynamic` it with `ssr:false`
 * — that keeps recharts out of the shared bundle and off the server render (it only loads on /reports).
 */
interface SkillRadarProps {
  skills: CandidateReportSkill[];
  showCohort: boolean;
}

export default function SkillRadar({ skills, showCohort }: SkillRadarProps) {
  const data = skills.map((skill) => ({
    axis: skill.key,
    candidate: Math.round(skill.scorePct),
    cohort: skill.cohortAvgPct != null ? Math.round(skill.cohortAvgPct) : null,
  }));

  const anyCohort = showCohort && skills.some((skill) => skill.cohortAvgPct != null);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e4e4e7" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#52525b" }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Candidate"
          dataKey="candidate"
          stroke="#4f46e5"
          fill="#4f46e5"
          fillOpacity={0.25}
          isAnimationActive={false}
        />
        {anyCohort ? (
          <Radar
            name="Cohort avg"
            dataKey="cohort"
            stroke="#94a3b8"
            fill="#94a3b8"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
        ) : null}
        <Tooltip
          formatter={(value: number | string) => (value == null ? "—" : `${value}%`)}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e4e4e7" }}
        />
        {anyCohort ? <RechartsLegend wrapperStyle={{ fontSize: 12 }} /> : null}
      </RadarChart>
    </ResponsiveContainer>
  );
}
