import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@repo/ui";
import { LanguageSwitcher } from "./language-switcher";

/**
 * Slim sticky top bar for the learning module. Hosts the theme toggle and the
 * language switcher (its natural home for top-level controls). Sticks to the
 * top of the scrolling content area while pages scroll underneath it.
 */
export async function LearningHeader() {
  const t = await getTranslations("theme");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <ThemeToggle
        labels={{
          light: t("light"),
          system: t("system"),
          dark: t("dark"),
          group: t("label"),
        }}
      />
      <LanguageSwitcher />
    </header>
  );
}
