import { AdminRedirectGuard } from "@/components/admin-redirect-guard";
import { LearnerCalendar } from "@/components/calendar/learner-calendar";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminRedirectGuard>
      <LearnerCalendar />
    </AdminRedirectGuard>
  );
}
