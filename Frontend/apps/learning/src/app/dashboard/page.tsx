import { Dashboard } from "@/components/dashboard/dashboard";
import { MOCK_TRAININGS } from "@/data/trainings";
import { MOCK_ENROLLED_TRAININGS } from "@/data/enrolled-trainings";

export default function DashboardPage() {
  return (
    <Dashboard
      trainings={MOCK_TRAININGS}
      enrolledTrainings={MOCK_ENROLLED_TRAININGS}
    />
  );
}
