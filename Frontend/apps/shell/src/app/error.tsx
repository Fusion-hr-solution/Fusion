"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@repo/ds";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.error");
  const locale = useLocale();
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">
          {t("title")}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {/* The error's own message is English; other languages say it plainly. */}
          {(locale === "en" && error.message) || t("fallback")}
        </p>
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </div>
  );
}
