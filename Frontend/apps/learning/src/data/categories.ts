import type { TrainingCategory, TrainingLevel } from "@/types";

export const CATEGORY_CONFIG: Record<
  TrainingCategory,
  { label: string; color: string; bgLight: string }
> = {
  leadership: {
    label: "Leadership",
    color: "#FFE600",
    bgLight: "bg-[#FFE600]/10 text-[#2E2E38] border-[#FFE600]/30",
  },
  technical: {
    label: "Technical",
    color: "#188CE5",
    bgLight: "bg-[#188CE5]/10 text-[#155CB4] border-[#188CE5]/30",
  },
  compliance: {
    label: "Compliance",
    color: "#007575",
    bgLight: "bg-[#007575]/10 text-[#007575] border-[#007575]/30",
  },
  "soft-skills": {
    label: "Soft Skills",
    color: "#724BC3",
    bgLight: "bg-[#724BC3]/10 text-[#724BC3] border-[#724BC3]/30",
  },
  finance: {
    label: "Finance",
    color: "#F76900",
    bgLight: "bg-[#F76900]/10 text-[#F76900] border-[#F76900]/30",
  },
  "data-analytics": {
    label: "Data & Analytics",
    color: "#168736",
    bgLight: "bg-[#168736]/10 text-[#168736] border-[#168736]/30",
  },
};

export const LEVEL_CONFIG: Record<
  TrainingLevel,
  { label: string; dotColor: string }
> = {
  beginner: { label: "Beginner", dotColor: "bg-[#168736]" },
  intermediate: { label: "Intermediate", dotColor: "bg-[#F76900]" },
  advanced: { label: "Advanced", dotColor: "bg-[#B9251C]" },
};
