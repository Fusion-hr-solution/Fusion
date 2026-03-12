import { MyTrainingsList } from "@/components/my-trainings-list";
import { MOCK_ENROLLED_TRAININGS } from "@/data/enrolled-trainings";

export default function MyTrainingsPage() {
  return <MyTrainingsList trainings={MOCK_ENROLLED_TRAININGS} />;
}
