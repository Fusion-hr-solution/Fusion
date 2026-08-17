"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  cn,
} from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import {
  ArrowLeft,
  Check,
  Mail,
  Phone,
  RotateCcw,
  UserRound,
} from "lucide-react";
import type { PeopleProfileDto } from "@repo/api";
import { usePeopleAccessStatus, usePeopleProfile } from "../api/use-people";
import {
  EmployeeIdentity,
  EmploymentStatus,
  Monogram,
  OrgPath,
  formatWorkforceDate,
} from "./workforce-ui";

function employmentLine(employment: PeopleProfileDto["employment"]): string {
  const { state, start, end } = employment;
  if (state === "Scheduled") return start ? `Planned start ${formatWorkforceDate(start, { month: "long" })}` : "Planned start pending";
  if (state === "Former") {
    if (start && end) return `${formatWorkforceDate(start, { month: "long" })} – ${formatWorkforceDate(end, { month: "long" })}`;
    return end ? `Ended ${formatWorkforceDate(end, { month: "long" })}` : "Employment ended";
  }
  if (state === "Incomplete") return "Employment details unavailable";
  return start ? `Active since ${formatWorkforceDate(start, { month: "long" })}` : "Active";
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <h2 className="type-eyebrow text-muted-foreground">{children}</h2>;
}

function ProfileSkeleton() {
  return (
    <PageContainer className="pb-16">
      <Skeleton className="mb-8 h-5 w-20" />
      <div className="flex items-center gap-5">
        <Skeleton className="size-16 rounded-[0.625rem]" />
        <div className="space-y-2.5"><Skeleton className="h-9 w-72" /><Skeleton className="h-4 w-56" /><Skeleton className="h-4 w-40" /></div>
      </div>
      <div className="mt-12 grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="space-y-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </PageContainer>
  );
}

export default function PeopleProfileWorkspace({ employeeKey }: { employeeKey: string }) {
  const profile = usePeopleProfile(employeeKey);
  const access = usePeopleAccessStatus(employeeKey, Boolean(profile.data));
  const searchParams = useSearchParams();
  const established = searchParams.get("established");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [showResult, setShowResult] = useState(Boolean(established));
  useBreadcrumbLabel(employeeKey, profile.data?.identity.displayName);

  useEffect(() => {
    if (profile.data && established) headingRef.current?.focus();
  }, [established, profile.data]);

  useEffect(() => {
    if (!showResult) return;
    const timer = window.setTimeout(() => setShowResult(false), 6000);
    return () => window.clearTimeout(timer);
  }, [showResult]);

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.error || !profile.data) {
    return (
      <PageContainer>
        <Empty className="min-h-[26rem] rounded-2xl border">
          <EmptyMedia variant="icon"><UserRound /></EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Employee not found</EmptyTitle>
            <EmptyDescription>The employee may not exist or may not be available in this tenant.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button asChild variant="outline"><Link href="/people"><ArrowLeft className="size-4" /> Back to People</Link></Button>
              {profile.error ? <Button variant="ghost" onClick={() => void profile.refetch()}><RotateCcw className="size-4" /> Retry</Button> : null}
            </div>
          </EmptyContent>
        </Empty>
      </PageContainer>
    );
  }

  const employee = profile.data;
  const { identity, employment, work, primaryManager } = employee;
  const scheduled = employment.state === "Scheduled";
  const headerLifecycle = scheduled
    ? (employment.start ? `Starts ${formatWorkforceDate(employment.start)}` : null)
    : employment.state === "Former" && employment.end
      ? `Ended ${formatWorkforceDate(employment.end)}`
      : null;
  const hasContact = Boolean(identity.workEmail || identity.phone);

  return (
    <PageContainer className="pb-16">
      <div className="mx-auto max-w-4xl">
      <Link href="/people" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" /> People
      </Link>

      <div role="status" aria-live="polite" className="sr-only">
        {established ? (established === "hire" ? "Employee hired." : "Employee added.") : ""}
      </div>
      {showResult && established ? (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success-subtle px-3 py-1.5 type-label text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
          <Check className="size-4 text-success" aria-hidden="true" />
          {established === "hire" ? "Employee hired" : "Employee added"}
        </div>
      ) : null}

      {/* Identity header — the strongest region */}
      <header
        className={cn(
          "flex items-start gap-5",
          established ? "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300" : "",
        )}
      >
        <Monogram name={identity.displayName} size="xl" accent={scheduled} />
        <div className="min-w-0 flex-1">
          <h1 ref={headingRef} tabIndex={-1} className="type-display text-balance outline-none">{identity.displayName}</h1>
          {work ? (
            <p className="mt-1.5 text-[0.95rem] leading-6">
              {work.jobTitle}
              <span className="text-muted-foreground"> · {work.organizationName}</span>
            </p>
          ) : (
            <p className="mt-1.5 type-body text-muted-foreground">Work details unavailable</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <EmploymentStatus state={employment.state} />
            {headerLifecycle ? <span className="type-meta text-muted-foreground">{headerLifecycle}</span> : null}
            <span aria-hidden="true" className="text-muted-foreground/40">·</span>
            <span className="type-code text-xs text-muted-foreground">{identity.employeeNumber}</span>
          </div>
        </div>
      </header>

      {/* Asymmetric body: work/employment narrative + quiet context rail */}
      <div className="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="min-w-0 space-y-9">
          {work ? (
            <section>
              <Eyebrow>Current work</Eyebrow>
              <div className="mt-3">
                <OrgPath
                  name={work.organizationName}
                  path={work.organizationPath}
                  unitClassName="type-panel-title text-foreground"
                />
              </div>
              <p className="mt-2 type-meta text-muted-foreground">
                {work.location ? <>{work.location} · </> : null}
                Effective from {formatWorkforceDate(work.effectiveFrom, { month: "long" })}
              </p>
            </section>
          ) : null}

          <section>
            <Eyebrow>Employment</Eyebrow>
            <p className="mt-3 text-[0.95rem]">{employmentLine(employment)}</p>
          </section>

          {employee.directReportCount > 0 ? (
            <section>
              <Eyebrow>Direct reports · {employee.directReportCount}</Eyebrow>
              <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {employee.directReports.map((report) => (
                  <li key={report.employeeKey}>
                    <EmployeeIdentity
                      name={report.displayName}
                      employeeNumber={report.employeeNumber}
                      href={`/people/${report.employeeKey}`}
                      size="sm"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Context rail — one justified surface */}
        <aside className="overflow-hidden rounded-2xl border bg-card">
          <div className="p-5">
            <Eyebrow>Reporting to</Eyebrow>
            <div className="mt-3">
              {primaryManager ? (
                <EmployeeIdentity
                  name={primaryManager.displayName}
                  employeeNumber={primaryManager.employeeNumber}
                  href={`/people/${primaryManager.employeeKey}`}
                  size="sm"
                />
              ) : (
                <p className="type-body text-muted-foreground">No manager</p>
              )}
            </div>
          </div>

          <div className="border-t p-5">
            <Eyebrow>Fusion access</Eyebrow>
            <div className="mt-2">
              {access.isLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : access.error ? (
                <>
                  <p className="type-body font-medium">Status unavailable</p>
                  <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void access.refetch()}>Retry</Button>
                </>
              ) : (
                <>
                  <p className="type-body font-medium">{access.data?.label ?? "Not linked"}</p>
                  {access.data?.detail && access.data.state === "Linked" ? <p className="truncate type-meta text-muted-foreground">{access.data.detail}</p> : null}
                </>
              )}
            </div>
          </div>

          {hasContact ? (
            <div className="border-t p-5">
              <Eyebrow>Contact</Eyebrow>
              <ul className="mt-2.5 space-y-2.5">
                {identity.workEmail ? (
                  <li className="flex items-center gap-2.5">
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <a href={`mailto:${identity.workEmail}`} className="truncate type-body underline-offset-4 hover:underline">{identity.workEmail}</a>
                  </li>
                ) : null}
                {identity.phone ? (
                  <li className="flex items-center gap-2.5">
                    <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="type-body">{identity.phone}</span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
      </div>
    </PageContainer>
  );
}
