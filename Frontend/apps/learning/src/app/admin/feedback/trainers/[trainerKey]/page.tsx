import { TrainerFeedbackDetailView } from "@/components/admin/feedback";

interface PageProps {
  params: Promise<{ trainerKey: string }>;
}

export default async function AdminTrainerFeedbackDetailPage({ params }: PageProps) {
  const { trainerKey } = await params;
  return <TrainerFeedbackDetailView trainerKey={decodeURIComponent(trainerKey)} />;
}
