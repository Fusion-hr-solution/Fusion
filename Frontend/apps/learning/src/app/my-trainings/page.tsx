import { MyTrainingsList } from "@/components/my-trainings-list";
import { MOCK_ENROLLED_TRAININGS } from "@/data/enrolled-trainings";
import { getMyTrainings } from "@/services/learning-service";

export default async function MyTrainingsPage() {
  let trainings;
  
  try {
    trainings = await getMyTrainings();
  } catch {
    // Fallback to mock data if API is unavailable or user is not authenticated
    console.warn("[MyTrainingsPage] Backend unavailable, using mock data");
    trainings = MOCK_ENROLLED_TRAININGS;
  }
  
  return <MyTrainingsList trainings={trainings} />;
}
