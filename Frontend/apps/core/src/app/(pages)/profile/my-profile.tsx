"use client";

import { useSay } from "@repo/ds/lib/say";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, User } from "lucide-react";
import { useFieldVisibility, useMyCard } from "@repo/api/query";
import { canEnterPerformance, useAuth } from "@repo/auth";
import { Button } from "@repo/ds";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
} from "@repo/ds/shell";
import { useOrgChartAccess } from "@/features/org-chart/api/use-org-chart-access";
import { WorkerProfile } from "@/features/people/components/worker-profile/worker-profile";
import { PerformanceRecordView } from "@/features/people/components/record-views";
import { WorkerProfileSkeleton } from "@/features/people/components/worker-profile/worker-profile-skeleton";
import { fromSelfDetails } from "@/features/people/components/worker-profile/worker-profile-view";
import { JobTab } from "@/features/people/components/worker-profile/job-tab";
import { PersonalTab } from "@/features/people/components/worker-profile/personal-tab";
import { PhotoDialog } from "@/features/people/components/worker-profile/photo-dialog";
import { useProfileTabs } from "@/features/people/components/worker-profile/profile-tabs";
import {
  useEmployeeDetailsById,
  useEmployeeReportingLines,
  useMyProfileContext,
} from "@/features/people/api/use-employees";
import { usePeoplePersonal, usePeopleProfile } from "@/features/people/api/use-people";

/** The signed-in person's own record: Job, Personal and Performance tabs. */
export function MyProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const orgChart = useOrgChartAccess();
  const t = useTranslations("profile.self");
  const tPhoto = useTranslations("profile.band");
  const say = useSay("profile");
  const locale = useLocale();
  const showPerformance = canEnterPerformance(user);
  const employeeId = user?.employeeId ?? null;
  const canViewProfile = !!employeeId;
  const [photoOpen, setPhotoOpen] = useState(false);
  const { tab, tabs } = useProfileTabs({ personal: true, performance: showPerformance });

  // The field policy every member may read (fusion-settings): no settings permission needed.
  const { data: settings } = useFieldVisibility({ enabled: canViewProfile });
  const { data: card } = useMyCard();

  const {
    data: details,
    error,
    isLoading,
  } = useEmployeeDetailsById(canViewProfile ? employeeId : null);
  const employeeKey = details?.stableEmployeeKey ?? "";

  const { data: reportingLines } = useEmployeeReportingLines(details?.stableEmployeeKey ?? null);
  const { data: profileContext, isLoading: isContextLoading } = useMyProfileContext(canViewProfile);
  const personal = usePeoplePersonal(employeeKey, Boolean(details));
  const managerKey = details?.currentManager?.managerStableEmployeeKey ?? "";
  const hasReports = (reportingLines?.directReports.length ?? 0) > 0;
  const team = usePeopleProfile(details && reportingLines && !hasReports ? managerKey : "", null);
  const own = usePeopleProfile(employeeKey, null);

  if (authLoading) {
    return <WorkerProfileSkeleton />;
  }

  // Workforce existence and Fusion-account linkage are separate concepts: a
  // signed-in account with no linked worker is not "profile unavailable".
  if (!employeeId) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title={t("title")} description={t("noLink")} />
        <PageEmpty
          icon={User}
          title={t("noLinkTitle")}
          description={t("noLinkDescription")}
        />
      </PageContainer>
    );
  }

  if (isLoading && !details && !error) {
    return <WorkerProfileSkeleton />;
  }

  if (error) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title={t("title")} />
        <PageError
          title={t("notFound")}
          description={t("notFoundDescription")}
        />
      </PageContainer>
    );
  }

  if (!details) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title={t("title")} description={t("unavailable")} />
        <PageEmpty
          icon={User}
          title={t("unableTitle")}
          description={t("unableDescription")}
        />
      </PageContainer>
    );
  }

  const view = fromSelfDetails(details, reportingLines, {
    timeline: profileContext?.timeline,
    access: profileContext?.access ?? null,
    photoUrl: card?.photoUrl ?? null,
    people: own.data,
  }, { say, locale });
  const teammates = (team.data?.directReports ?? [])
    .filter((mate) => mate.employeeKey !== employeeKey)
    .map((mate) => ({ name: mate.displayName, href: `/people/${mate.employeeKey}`, jobTitle: mate.jobTitle, photoUrl: mate.photoUrl }));
  const canChangePhoto = personal.data?.canEdit === true;

  return (
    <>
      <WorkerProfile
        view={view}
        tabs={tabs}
        currentTab={tab}
        teammates={teammates}
        orgChartHref={orgChart.canSee ? "/org-chart" : undefined}
        photoAction={
          canChangePhoto ? (
            <Button size="icon" variant="outline" className="size-9 rounded-full bg-popover shadow-raised" aria-label={tPhoto("changePhoto")} onClick={() => setPhotoOpen(true)}>
              <Camera className="size-4" aria-hidden />
            </Button>
          ) : undefined
        }
        reportsFooter={
          view.directReportCount > 5 ? (
            <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0">
              <Link href="/team">
                {t("viewAll", { count: view.directReportCount })}
                <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      >
        {tab === "personal" ? (
          <PersonalTab
            employeeKey={employeeKey}
            displayName={view.displayName}
            workEmail={view.workEmail}
            isSelf
            selfService={{
              canEditPreferredName: settings?.selfService.canEditPreferredName !== false,
              canEditPhone: settings?.selfService.canEditPhone !== false,
            }}
          />
        ) : tab === "performance" ? (
          <PerformanceRecordView employeeId={details.id} />
        ) : (
          <JobTab view={view} timeline={{ events: view.timeline, isLoading: isContextLoading }} />
        )}
      </WorkerProfile>
      {canChangePhoto ? (
        <PhotoDialog
          open={photoOpen}
          onOpenChange={setPhotoOpen}
          employeeKey={employeeKey}
          displayName={view.displayName}
          photoUrl={view.photoUrl}
          isSelf
        />
      ) : null}
    </>
  );
}
