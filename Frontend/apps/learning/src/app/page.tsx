import { TrainingCatalog } from "@/components";
import { MOCK_TRAININGS } from "@/data/trainings";
import { getTrainings } from "@/services/learning-service";

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  let trainings;
  
  try {
    trainings = await getTrainings();
  } catch {
    // Fallback to mock data if API is unavailable
    console.warn("[LearningPage] Backend unavailable, using mock data");
    trainings = MOCK_TRAININGS;
  }
  
  return <TrainingCatalog trainings={trainings} />;
}
