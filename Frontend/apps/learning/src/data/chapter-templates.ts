import { FileText, Video, FileUp, Code2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * `type` is the stable union key used for i18n lookup in client components
 * (adminChapters.contentTypes.<type>.label / .description).
 * The `label` / `description` here are English fallbacks for any consumer
 * that has not yet been wired to next-intl; prefer translating by `type`.
 */
export interface ContentTypeConfig {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
  iconColorClass: string;
}

export const CONTENT_TYPES: ContentTypeConfig[] = [
  {
    type: "Article",
    label: "Article",
    description:
      "Structured text with sections like introduction, body, and conclusion",
    icon: FileText,
    colorClass: "bg-[hsl(var(--ey-blue-500))]/10",
    iconColorClass: "text-[hsl(var(--ey-blue-500))]",
  },
  {
    type: "Video",
    label: "Video",
    description: "Upload a video file or provide an external URL",
    icon: Video,
    colorClass: "bg-[hsl(var(--ey-teal-500))]/10",
    iconColorClass: "text-[hsl(var(--ey-teal-500))]",
  },
  {
    type: "Pdf",
    label: "PDF Document",
    description: "Upload a PDF document for reading material",
    icon: FileUp,
    colorClass: "bg-[hsl(var(--ey-orange-500))]/10",
    iconColorClass: "text-[hsl(var(--ey-orange-500))]",
  },
  {
    type: "Exercise",
    label: "Exercise",
    description: "Hands-on practice with instructions, tasks, and solutions",
    icon: Code2,
    colorClass: "bg-[hsl(var(--ey-green-500))]/10",
    iconColorClass: "text-[hsl(var(--ey-green-500))]",
  },
];

export interface ArticleTemplateConfig {
  name: string;
  description: string;
  sections: { label: string; placeholder: string }[];
}

export const ARTICLE_TEMPLATES: ArticleTemplateConfig[] = [
  {
    name: "Standard Article",
    description: "Classic structure with intro, body, and conclusion",
    sections: [
      {
        label: "Introduction",
        placeholder: "Provide an overview of the topic...",
      },
      { label: "Body", placeholder: "Main content of the article..." },
      { label: "Conclusion", placeholder: "Summarize the key takeaways..." },
    ],
  },
  {
    name: "Step-by-Step Tutorial",
    description: "Goal, prerequisites, step-by-step instructions, and wrap-up",
    sections: [
      { label: "Objective", placeholder: "What the reader will learn..." },
      { label: "Prerequisites", placeholder: "Required knowledge or tools..." },
      { label: "Steps", placeholder: "Detailed step-by-step instructions..." },
      { label: "Summary", placeholder: "Recap what was covered..." },
    ],
  },
  {
    name: "Case Study",
    description:
      "Real-world scenario with background, challenge, solution, and results",
    sections: [
      {
        label: "Background",
        placeholder: "Context and background information...",
      },
      { label: "Challenge", placeholder: "The problem or challenge faced..." },
      { label: "Solution", placeholder: "How the challenge was addressed..." },
      { label: "Results", placeholder: "Outcomes and measurable results..." },
    ],
  },
];
