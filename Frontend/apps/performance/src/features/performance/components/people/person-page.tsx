"use client";

import Link from "next/link";
import { canEnterCoreHr, useAuth } from "@repo/auth";
import { Button, Skeleton } from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { PersonPerformanceSummary, type RenderSummaryLink } from "@repo/performance-ui";
import { usePersonSummary } from "../../api/use-performance";
import { PerformancePageHeading } from "../performance-page-heading";

const BASE_PATH = "/performance";

/** Performance paths open with the router; anything else is another app and needs a full navigation. */
export const renderPerformanceLink: RenderSummaryLink = ({ href, className, children }) =>
  href === BASE_PATH || href.startsWith(`${BASE_PATH}/`) ? (
    <Link href={href.slice(BASE_PATH.length) || "/"} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );

/** One person inside Performance (D-32): their summary, with a way to their Core HR record. */
export function PersonPage({ employeeId }: { employeeId: string }) {
  const { user } = useAuth();
  const summary = usePersonSummary(employeeId);
  const person = summary.data;
  const coreRecord = person?.stableEmployeeKey && canEnterCoreHr(user) ? `/core/people/${person.stableEmployeeKey}` : null;
  const context = [person?.jobTitle, person?.orgUnitName].filter(Boolean);

  return (
    <PageContainer>
      {person ? (
        <PerformancePageHeading
          title={person.displayName ?? "Person"}
          description={context.length ? context.join(", ") : undefined}
          actions={
            coreRecord ? (
              <Button asChild variant="outline">
                <a href={coreRecord}>Open Core HR record</a>
              </Button>
            ) : undefined
          }
        />
      ) : summary.error ? (
        <PerformancePageHeading title="Person" />
      ) : (
        <div className="mb-4 space-y-2" aria-hidden>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      )}
      <div className="mt-6">
        <PersonPerformanceSummary
          renderLink={renderPerformanceLink}
          state={
            person
              ? { status: "ready", summary: person }
              : summary.error
                ? { status: "error", onRetry: () => void summary.refetch() }
                : { status: "loading" }
          }
        />
      </div>
    </PageContainer>
  );
}
