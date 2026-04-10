import { ChapterBuilder } from "@/components/admin/chapter-builder";

interface PageProps {
  params: Promise<{ id: string; chapterId: string }>;
}

export default async function ChapterBuilderPage({ params }: PageProps) {
  const { id, chapterId } = await params;
  return <ChapterBuilder trainingId={id} chapterId={chapterId} />;
}
