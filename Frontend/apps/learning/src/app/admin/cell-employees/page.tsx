import type { Metadata } from "next";
import { CellEmployeesPage } from "@/components/admin/cell-employees-page";

export const metadata: Metadata = {
  title: "Cell Employees — Admin",
};

interface PageProps {
  searchParams: Promise<{
    gradeId?: string;
    serviceLineId?: string;
    gradeName?: string;
    serviceLineName?: string;
  }>;
}

export default async function CellEmployeesPageRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <CellEmployeesPage
      gradeId={params.gradeId ?? ""}
      serviceLineId={params.serviceLineId ?? ""}
      gradeName={params.gradeName ?? ""}
      serviceLineName={params.serviceLineName ?? ""}
    />
  );
}
