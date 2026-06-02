import type { Metadata } from "next";
import { EmployeeAttendanceView } from "@/components/admin/attendance";

export const metadata: Metadata = {
  title: "Employee Attendance — Admin",
};

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function EmployeeAttendancePage({ params }: PageProps) {
  const { employeeId } = await params;
  return <EmployeeAttendanceView employeeId={employeeId} />;
}
