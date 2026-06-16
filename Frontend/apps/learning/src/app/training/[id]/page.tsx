import { notFound } from "next/navigation";
import { TrainingDetailPage } from "@/components/training-detail-page";
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
  } catch (err) {
    console.error("[TrainingPage] Failed to load the training:", err);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-semibold text-foreground">We couldn&apos;t load this training</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The training service is unavailable right now. Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (!training) {
    notFound();
  }

  return <TrainingDetailPage training={training} />;
}
