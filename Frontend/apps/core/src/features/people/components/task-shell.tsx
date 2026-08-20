"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@repo/ds/shell";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import { Monogram } from "./workforce-ui";

/**
 * The shared chrome for a routable workforce maintenance task (Change Work,
 * Change Manager, End Employment). A business action, not a generic form: the
 * subject leads, the effective date and inputs live in the working column, and
 * the resulting state sits alongside as a live preview (`aside`) — beside the
 * inputs on desktop, following them when narrow.
 *
 * It also registers the employee's display name as the breadcrumb label for the
 * key segment, so the visible trail reads "People > Karim Zayed > Change work"
 * on every task route rather than leaking the opaque employee key.
 */
export function TaskShell({
  employeeKey,
  subjectName,
  subjectContext,
  title,
  children,
  aside,
}: {
  employeeKey: string;
  subjectName: string | null;
  subjectContext?: string | null;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  useBreadcrumbLabel(employeeKey, subjectName ?? undefined);

  return (
    <PageContainer className="pb-16">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/people/${employeeKey}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden /> {subjectName ?? "Back"}
        </Link>

        <header className="mt-5 flex items-center gap-4 border-b pb-6">
          {subjectName ? <Monogram name={subjectName} size="lg" /> : null}
          <div className="min-w-0">
            <h1 className="type-page-title text-foreground">{title}</h1>
            {subjectName ? (
              <p className="mt-1 type-meta text-muted-foreground">
                {subjectName}
                {subjectContext ? <span> · {subjectContext}</span> : null}
              </p>
            ) : null}
          </div>
        </header>

        {aside ? (
          <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="min-w-0">{children}</div>
            <aside className="lg:sticky lg:top-6">{aside}</aside>
          </div>
        ) : (
          <div className="mt-8 max-w-2xl">{children}</div>
        )}
      </div>
    </PageContainer>
  );
}
