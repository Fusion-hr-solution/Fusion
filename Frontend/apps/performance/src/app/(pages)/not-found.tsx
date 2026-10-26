import Link from "next/link";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PageEmpty } from "@repo/ds/shell";
import { useTranslations } from "next-intl";

/** A Performance address that matches no record renders here, inside the Performance frame. */
export default function PerformanceNotFound() {
  const t = useTranslations("common.PerformanceNotFound");
  return (
    <PageContainer>
      <PageEmpty
        headingLevel={1}
        title={t("nothingHere")}
        description={t("thisAddressDoesntMatchAnything")}
        action={
          <Button asChild variant="outline">
            <Link href="/">{t("goToOverview")}</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
