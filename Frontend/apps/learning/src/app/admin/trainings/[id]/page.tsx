import { TrainingDetailView } from "@/components/admin/training-detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TrainingDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TrainingDetailView trainingId={id} />;
}
