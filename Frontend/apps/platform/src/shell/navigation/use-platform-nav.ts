"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ShellNavSection } from "@repo/ds/shell";
import { PLATFORM_NAV } from "@/data/sidebar-nav";

/** Platform's navigation with its labels in the person's language, for the sidebar and the breadcrumb. */
export function usePlatformNav(): ShellNavSection {
  const t = useTranslations("frame.nav");
  return useMemo(
    () => ({
      ...PLATFORM_NAV,
      items: PLATFORM_NAV.items.map((item) => ({
        ...item,
        label: t(item.label as "tenants"),
      })),
    }),
    [t]
  );
}
