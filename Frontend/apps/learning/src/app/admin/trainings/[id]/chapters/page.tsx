import { ChapterManager } from "@/components/admin/chapter-manager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChaptersPage({ params }: PageProps) {
  const { id } = await params;
  return <ChapterManager trainingId={id} />;
}
