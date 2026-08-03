"use client";

import { useMemo } from "react";
import { Check, Minus } from "lucide-react";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import type { TenantDetail } from "../api";
import {
  buildModuleOptions,
  type ProvisioningModuleOption,
} from "../provisioning/module-catalogue";
import { useProvisionableModules } from "../queries";
import { IconTile } from "./record-ui";
import { NOT_AVAILABLE } from "../availability";
import { coreSetupState } from "./tenant-record-facts";

/**
 * What this tenant is entitled to, against everything Fusion recognises.
 *
 * Four states that must not blur into each other: a module granted with every
 * tenant, one this tenant has, one it could have but does not, and one the
 * platform cannot grant at all. Collapsing the last two would make a product
 * gap look like a decision someone made about this tenant.
 */

export type EntitlementState =
  | "included"
  | "enabled"
  | "disabled"
  | "unavailable";

const STATE_LABEL: Record<EntitlementState, string> = {
  included: "Included",
  enabled: "Enabled",
  disabled: "Disabled",
  unavailable: NOT_AVAILABLE,
};

export interface ModuleEntitlement {
  option: ProvisioningModuleOption;
  state: EntitlementState;
  /**
   * The owning module's own setup state, shown only where an owner actually
   * supplies one. A generic readiness label invented by Platform would imply a
   * lifecycle no module has agreed to.
   */
  setupState: string | null;
}

export function entitlementsFor(
  tenant: TenantDetail,
  options: readonly ProvisioningModuleOption[]
): ModuleEntitlement[] {
  return options.map((option) => {
    const isEntitled =
      option.module !== null && tenant.modules.includes(option.module);

    const state: EntitlementState =
      option.availability === "unavailable"
        ? "unavailable"
        : option.availability === "included"
          ? "included"
          : isEntitled
            ? "enabled"
            : "disabled";

    return {
      option,
      state,
      // Core HR is the only module that reports one today.
      setupState:
        state === "included" && isEntitled ? coreSetupState(tenant) : null,
    };
  });
}

export function useTenantEntitlements(tenant: TenantDetail) {
  const catalogue = useProvisionableModules();

  // `buildModuleOptions` sorts the catalogue, and this runs on every render of
  // both consumers. Keyed on `catalogue.data` rather than on `?? []`, which
  // would be a fresh array literal each time and defeat the memo.
  const options = useMemo(
    () => buildModuleOptions(catalogue.data ?? []),
    [catalogue.data]
  );

  const entitlements = useMemo(
    () => entitlementsFor(tenant, options),
    [tenant, options]
  );

  const granted = useMemo(
    () =>
      entitlements.filter(
        (entry) => entry.state === "included" || entry.state === "enabled"
      ),
    [entitlements]
  );

  return {
    entitlements,
    /** What the tenant actually has, which is what a summary counts. */
    granted,
    isLoading: catalogue.isLoading,
    error: catalogue.error,
  };
}

/**
 * The catalogue as a grid of capability cards rather than a list of names.
 *
 * A module is a product, and a row of text made all six read as configuration
 * flags. Given a card each, what the tenant has and what the build cannot yet
 * grant separate at a glance — and the grid grows to a seventh module without
 * any change to how it is read.
 *
 * Presentational: the destination owns the query, so this renders equally well
 * from a live read or a fixture.
 */
export function ModuleCatalogue({
  entitlements,
  isLoading,
  error,
}: {
  entitlements: readonly ModuleEntitlement[];
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    // An unread catalogue is not an empty one; claiming every module is
    // unavailable would be a guess.
    return (
      <p className="text-sm text-muted-foreground">
        The module catalogue could not be loaded. This tenant&apos;s entitlements
        have not changed.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {entitlements.map((entry) => (
        <ModuleCard key={entry.option.key} entitlement={entry} />
      ))}
    </ul>
  );
}

function ModuleCard({ entitlement }: { entitlement: ModuleEntitlement }) {
  const { option, state, setupState } = entitlement;
  const Icon = option.icon;
  const isGranted = state === "included" || state === "enabled";
  const isUnavailable = state === "unavailable";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4",
        isGranted
          ? "border-border bg-card shadow-xs"
          : isUnavailable
            ? "border-dashed border-border bg-muted/25"
            : "border-border bg-card/60"
      )}
    >
      <div className="flex items-start gap-3">
        <IconTile
          icon={Icon}
          size="sm"
          className={isGranted ? "bg-primary/12 text-primary" : "bg-muted"}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-semibold",
              isGranted ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {option.label}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {option.description}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1">
        <EntitlementState state={state} />
        {setupState ? (
          <span className="rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">
            {setupState}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The state, in words, with a glyph that agrees with them — so the distinction
 * is never carried by weight and colour alone.
 */
export function EntitlementState({
  state,
  setupState,
}: {
  state: EntitlementState;
  setupState?: string | null;
}) {
  const isGranted = state === "included" || state === "enabled";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium",
        isGranted
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-muted-foreground"
      )}
    >
      {state === "unavailable" ? null : isGranted ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Minus aria-hidden="true" className="size-3.5" />
      )}
      {STATE_LABEL[state]}
      {setupState ? (
        <span className="font-normal text-muted-foreground">· {setupState}</span>
      ) : null}
    </span>
  );
}
