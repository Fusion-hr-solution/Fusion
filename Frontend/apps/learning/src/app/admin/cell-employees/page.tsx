import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CellEmployeesPage } from "@/components/admin/cell-employees-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMeta");
  return { title: t("cellEmployees") };
}

interface PageProps {
  searchParams: Promise<{
    gradeId?: string;
    serviceLineId?: string;
    gradeName?: string;
    serviceLineName?: string;
  }>;
}

export default async function CellEmployeesPageRoute({
  searchParams,
}: PageProps) {
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
