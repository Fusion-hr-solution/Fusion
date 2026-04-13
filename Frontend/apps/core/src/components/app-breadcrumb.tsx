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
import { APP_NAME } from "@/config/constants";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";

// Flat map: "/path-segment" → "Human Label" from all nav sections
const NAV_LABEL_MAP: Record<string, string> = Object.fromEntries(
  [PEOPLE_NAV, ADMIN_NAV].flatMap((section) =>
    section.items.map(({ href, label }) => [href, label])
  )
);

function resolveLabel(segment: string): string {
  return (
    NAV_LABEL_MAP[`/${segment}`] ??
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

export function AppBreadcrumb() {
  const pathname = usePathname();

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
                <Link href="/">{APP_NAME}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              const href = "/" + segments.slice(0, index + 1).join("/");
              const label = resolveLabel(segment);

              return (
                <React.Fragment key={href}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href}>{label}</Link>
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
