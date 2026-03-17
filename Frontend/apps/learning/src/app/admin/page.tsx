import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { MOCK_EMPLOYEES } from "@/data/employees";
import { MOCK_TRAININGS } from "@/data/trainings";

export default function AdminDashboardPage() {
  return (
    <AdminDashboard employees={MOCK_EMPLOYEES} trainings={MOCK_TRAININGS} />
  );
}
