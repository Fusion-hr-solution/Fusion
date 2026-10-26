import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ds";

export default function NotFound() {
  const t = useTranslations("app.notFound");
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-4xl font-bold tracking-tight mb-2">404</h2>
        <p className="text-muted-foreground mb-6">
          {t("detail")}
        </p>
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
