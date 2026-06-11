"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/locale";

const SWITCH_LABEL_KEY: Record<Locale, "switchToEn" | "switchToFr"> = {
  en: "switchToEn",
  fr: "switchToFr",
};

export function LanguageSwitcher({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const buttons = LOCALES.map((code) => {
    const isActive = code === locale;
    return (
      <button
        key={code}
        type="button"
        lang={code}
        onClick={() => switchTo(code)}
        disabled={isPending}
        aria-pressed={isActive}
        aria-label={t(SWITCH_LABEL_KEY[code])}
        className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          isActive
            ? "ey-bg-dark text-white"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {code}
      </button>
    );
  });

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-0.5 rounded-lg border border-border/60 bg-white p-0.5"
        role="group"
        aria-label={t("label")}
      >
        {buttons}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Languages className="h-3 w-3" aria-hidden="true" />
        {t("label")}
      </span>
      <div
        className="inline-flex gap-0.5 rounded-lg border border-border/60 bg-white p-0.5"
        role="group"
        aria-label={t("label")}
      >
        {buttons}
      </div>
    </div>
  );
}
