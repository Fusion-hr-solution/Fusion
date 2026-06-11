"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { useBreadcrumbOverridesMap } from "@/shell/breadcrumb-overrides";
import { APP_NAME } from "@/config/constants";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { buildTenantContextHref } from "@/lib/tenant-navigation";

// Flat map: "/path-segment" → "Human Label" from all nav sections
const NAV_LABEL_MAP: Record<string, string> = Object.fromEntries(
  [PEOPLE_NAV, ADMIN_NAV].flatMap((section) =>
    section.items.map(({ href, label }) => [href, label])
  )
);

const UUID_SEGMENT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveLabel(segment: string, overrides: Map<string, string>): string {
  if (UUID_SEGMENT_REGEX.test(segment)) {
    return overrides.get(segment) ?? "Profile";
  }

  return (
    overrides.get(segment) ??
    NAV_LABEL_MAP[`/${segment}`] ??
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const overrides = useBreadcrumbOverridesMap();
  const { tenantId, tenantSlug } = useTenantContext();

  // Strip /core prefix emitted by the MFE router
  const clean = pathname.replace(/^\/core/, "") || "/";
  const segments = clean === "/" ? [] : clean.split("/").filter(Boolean);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.length === 0 ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{APP_NAME}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={buildTenantContextHref("/", tenantId, tenantSlug)}>{APP_NAME}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              const href = "/" + segments.slice(0, index + 1).join("/");
              const label = resolveLabel(segment, overrides);

              return (
                <React.Fragment key={href}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                          <Link href={buildTenantContextHref(href, tenantId, tenantSlug)}>{label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
