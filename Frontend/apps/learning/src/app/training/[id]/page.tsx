import { notFound } from "next/navigation";
import { TrainingDetailPage } from "@/components/training-detail-page";
import { MOCK_TRAININGS } from "@/data/trainings";
import { getTrainingById } from "@/services/learning-service";

export const dynamic = "force-dynamic";

interface TrainingPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrainingPage({ params }: TrainingPageProps) {
  const { id } = await params;

  let training;

  try {
    training = await getTrainingById(id);
  } catch {
    // Fallback to mock data if API is unavailable
    console.warn("[TrainingPage] Backend unavailable, using mock data");
    training = MOCK_TRAININGS.find((t) => t.id === id) ?? null;
  }

  if (!training) {
    notFound();
  }

  return <TrainingDetailPage training={training} />;
}
