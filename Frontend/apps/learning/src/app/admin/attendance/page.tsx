import type { Metadata } from "next";
import { AttendanceRatesSection } from "@/components/admin/attendance";

export const metadata: Metadata = {
  title: "Attendance — Admin",
};

export default function AttendancePage() {
  return (
    <section className="space-y-8 px-8 py-8">
      <AttendanceRatesSection />
    </section>
  );
}
