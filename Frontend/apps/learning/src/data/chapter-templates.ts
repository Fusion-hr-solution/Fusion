import { FileText, Video, FileUp, Code2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
    description: "Structured text with sections like introduction, body, and conclusion",
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
