import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@repo/ds/shell";

export default async function Loading() {
  const t = await getTranslations("frame");
  return <PageSkeleton rows={3} label={t("loading")} />;
}
