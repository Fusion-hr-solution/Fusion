"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Handshake,
  Layers,
  Settings2,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import type { TenantModule } from "../api";
import { destinationHref } from "./record-routes";
import { useTenantRecord } from "./record-shell";

/**
 * The tenant's product access.
 *
 * A summary of the platform-owned entitlements, not the place they are changed:
 * it shows every Fusion product and where this tenant stands on each, and hands
 * off to the Products destination for the actual management. Core HR is the
 * workforce foundation every tenant gets, so it reads as included rather than as
 * an entitlement someone chose; a product this tenant is entitled to is enabled,
 * and one it is not is disabled — access, not a missing feature.
 *
 * The full catalogue is shown so the operator sees the whole picture at once,
 * rather than only the two products the entitlement model can currently toggle;
 * the rest are honestly disabled until that model grows to enable them.
 */
interface ProductDefinition {
  key: string;
  label: string;
  icon: LucideIcon;
  /** The entitlement this product maps to, when the model knows one. */
  module?: TenantModule;
  /** Granted with every tenant regardless of entitlement. */
  mandatory?: boolean;
}

const PRODUCTS: ProductDefinition[] = [
  { key: "core", label: "Core HR", icon: BrainCircuit, module: "CoreHR", mandatory: true },
  { key: "performance", label: "Performance", icon: BarChart3, module: "Performance" },
  { key: "learning", label: "Learning", icon: BookOpen },
  { key: "recruitment", label: "Recruitment", icon: UsersRound },
  { key: "onboarding", label: "Onboarding", icon: Handshake },
  { key: "interview", label: "Interview", icon: Video },
];

interface ProductRow {
  key: string;
  label: string;
  state: "Included" | "Enabled" | "Disabled";
  tone: StatusTone;
  icon: LucideIcon;
}

export function TenantProducts() {
  const { tenant, query } = useTenantRecord();

  const rows: ProductRow[] = PRODUCTS.map((product) => {
    const enabled = product.module
      ? tenant.modules.includes(product.module)
      : false;
    const state = product.mandatory
      ? "Included"
      : enabled
        ? "Enabled"
        : "Disabled";
    return {
      key: product.key,
      label: product.label,
      state,
      // Included and enabled read as present; disabled recedes rather than
      // alarms — it is an access state, not a fault.
      tone: state === "Disabled" ? "muted" : "success",
      icon: product.icon,
    };
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Layers aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Products</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Product access for this tenant.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`${destinationHref(tenant.tenantId, "products")}${query}`}>
            <Settings2 aria-hidden="true" />
            Manage products
          </Link>
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-4 px-4 py-3">
            <row.icon
              aria-hidden="true"
              className={cn(
                "size-5 shrink-0",
                row.state === "Disabled"
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium",
                row.state === "Disabled" ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {row.label}
            </span>
            <StatusBadge tone={row.tone} dot>
              {row.state}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </section>
  );
}
