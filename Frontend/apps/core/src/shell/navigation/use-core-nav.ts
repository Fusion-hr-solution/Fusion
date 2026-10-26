"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ShellNavSection } from "@repo/ds/shell";
import { ADMIN_NAV, PEOPLE_NAV } from "@/data/sidebar-nav";

type NavKey = "people";

/** Core HR's navigation with its titles and labels in the person's language, for the sidebar and the breadcrumb. */
export function useCoreNav(): { people: ShellNavSection; admin: ShellNavSection } {
  const t = useTranslations("frame.nav");
  return useMemo(() => {
    const word = (section: ShellNavSection): ShellNavSection => ({
      ...section,
      title: section.title ? t(section.title as NavKey) : section.title,
      items: section.items.map((item) => ({ ...item, label: t(item.label as NavKey) })),
    });
    return { people: word(PEOPLE_NAV), admin: word(ADMIN_NAV) };
  }, [t]);
}
