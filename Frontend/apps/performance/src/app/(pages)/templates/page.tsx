import type { Metadata } from "next";
import { TemplateLibraryPage } from "@/components/objective-templates/template-library-page";

export const metadata: Metadata = {
  title: "Template Library | EY Performance",
};

export default function TemplatesPage() {
  return <TemplateLibraryPage />;
}
