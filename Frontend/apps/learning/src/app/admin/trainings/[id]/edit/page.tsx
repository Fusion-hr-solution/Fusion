import { EditTrainingWizard } from "@/components/admin/edit-training-wizard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTrainingPage({ params }: PageProps) {
  const { id } = await params;
  return <EditTrainingWizard trainingId={id} />;
}
