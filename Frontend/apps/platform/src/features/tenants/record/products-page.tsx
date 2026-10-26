"use client";

import { useTranslations } from "next-intl";
import { Layers } from "@/lib/icons";
import { cn } from "@repo/ds/lib/utils";
import { useFormat } from "@repo/ds/lib/use-format";
import { StatusBadge } from "@repo/ds/shell";
import { productRows } from "./products-summary";
import { useTenantRecord } from "./record-shell";

/**
 * Every Fusion product and where this tenant stands on each, with when and by
 * whom access was granted.
 *
 * Entitlements are recorded once, at provisioning, so the grant date is the
 * tenant's creation and the grantor is whoever provisioned it. Changing them
 * afterwards is not built: the products a person can open travel in their
 * sign-in, so turning one off needs its own design rather than a toggle here.
 */
export function TenantProductsDestination() {
  const { tenant } = useTenantRecord();
  const t = useTranslations("record.productsPage");
  const states = useTranslations("record.products.states");
  const format = useFormat();
  const rows = productRows(tenant.modules);
  const inUse = rows.filter((row) => row.state !== "Disabled").length;
  const provisioned = tenant.history.find(
    (entry) => entry.eventType === "TenantProvisioned"
  );
  const grantedBy = provisioned?.actorName?.trim();

  return (
    <section className="rounded-surface border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <Layers
          aria-hidden="true"
          className="size-8 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {t("title")}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("count", { count: inUse, total: rows.length })}
          </p>
        </div>
      </header>

      <div className="mt-4 overflow-x-auto rounded-surface border border-border bg-inlay">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("product")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("status")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("granted")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const disabled = row.state === "Disabled";
              return (
                <tr key={row.key}>
                  <th scope="row" className="px-4 py-3 text-start font-medium">
                    <span className="flex items-center gap-3">
                      <row.icon
                        aria-hidden="true"
                        className={cn(
                          "size-5 shrink-0",
                          disabled
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={
                          disabled ? "text-muted-foreground" : "text-foreground"
                        }
                      >
                        {row.label}
                      </span>
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <StatusBadge tone={row.tone} dot>
                      {states(row.state)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {disabled ? (
                      <span aria-label={t("notGranted")}>—</span>
                    ) : (
                      <>
                        <span className="text-foreground">
                          {format.date(tenant.createdAt, { year: "always" })}
                        </span>
                        <span className="block text-xs">
                          {grantedBy
                            ? t("byPerson", { name: grantedBy })
                            : t("atProvisioning")}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
