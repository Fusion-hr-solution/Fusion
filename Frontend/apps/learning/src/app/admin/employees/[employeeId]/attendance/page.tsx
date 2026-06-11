import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmployeeAttendanceView } from "@/components/admin/attendance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMeta");
  return { title: t("employeeAttendance") };
}

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function EmployeeAttendancePage({ params }: PageProps) {
  const { employeeId } = await params;
  return <EmployeeAttendanceView employeeId={employeeId} />;
}
