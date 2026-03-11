import { TrainingCatalog } from "@/components";
import { MOCK_TRAININGS } from "@/data/trainings";

export default function LearningPage() {
  return <TrainingCatalog trainings={MOCK_TRAININGS} />;
}
