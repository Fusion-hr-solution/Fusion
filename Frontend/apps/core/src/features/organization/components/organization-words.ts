"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { OrganizationChangeDto, OrganizationBusinessEventKind } from "@repo/api";

const KINDS = new Set(["Created", "Renamed", "TypeChanged", "Moved", "Inactivated"]);

/** How a recorded Organization change reads: its kind ("Moved + Renamed") and what changed ("A → B"). */
export function useOrganizationEvents() {
  const t = useTranslations("organization.events");
  return useMemo(() => {
    const kindLabel = (kind: OrganizationBusinessEventKind) =>
      typeof kind === "string" && KINDS.has(kind) ? t(kind as "Moved") : String(kind);
    const contextOf = (change: OrganizationChangeDto, kind: OrganizationBusinessEventKind | undefined) => {
      if (kind === "Moved")
        return `${change.before?.parent?.name ?? t("noParent")} → ${change.after?.parent?.name ?? t("noParent")}`;
      if (kind === "Renamed") return `${change.before?.name ?? "—"} → ${change.after?.name ?? "—"}`;
      if (kind === "TypeChanged") return `${change.before?.type.name ?? "—"} → ${change.after?.type.name ?? "—"}`;
      if (kind === "Inactivated") return t("inactivated");
      return change.summary ?? t("established");
    };
    return {
      label: (change: OrganizationChangeDto) =>
        change.businessEventKinds.map(kindLabel).join(" + ") || String(change.kind),
      /** What changed, read from the first business event that says something (the inspector's order). */
      context: (change: OrganizationChangeDto) => {
        const kinds = change.businessEventKinds;
        const kind = (["Moved", "Renamed", "TypeChanged", "Inactivated"] as const).find((candidate) =>
          kinds.includes(candidate)
        );
        return contextOf(change, kind);
      },
      /** What changed, read from the change's first business event (the upcoming-changes sheet). */
      firstContext: (change: OrganizationChangeDto) => contextOf(change, change.businessEventKinds[0]),
    };
  }, [t]);
}
