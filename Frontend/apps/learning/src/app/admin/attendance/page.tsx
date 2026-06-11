import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AttendanceRatesSection } from "@/components/admin/attendance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMeta");
  return { title: t("attendance") };
}

export default function AttendancePage() {
  return (
    <section className="space-y-8 px-8 py-8">
      <AttendanceRatesSection />
    </section>
  );
}
