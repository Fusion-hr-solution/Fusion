import { TrainingForm } from "@/components/admin/training-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTrainingPage({ params }: PageProps) {
  const { id } = await params;
  return <TrainingForm trainingId={id} />;
}
