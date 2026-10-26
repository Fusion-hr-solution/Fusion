"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("frame.error");
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">{t("title")}</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{t("description")}</p>
        <Button onClick={reset}>{t("action")}</Button>
      </div>
    </div>
  );
}
