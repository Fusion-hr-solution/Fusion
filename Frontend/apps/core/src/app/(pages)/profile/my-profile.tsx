"use client";

import { useSay } from "@repo/ds/lib/say";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, User } from "lucide-react";
import { useFieldVisibility } from "@repo/api/query";
import { canEnterPerformance, useAuth } from "@repo/auth";
import { notFound } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@repo/ds";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
} from "@repo/ds/shell";
import { toast } from "sonner";
import { WorkerProfile } from "@/features/people/components/worker-profile/worker-profile";
import {
  PerformanceRecordView,
  RecordViewSwitcher,
} from "@/features/people/components/record-views";
import { WorkerProfileSkeleton } from "@/features/people/components/worker-profile/worker-profile-skeleton";
import { fromSelfDetails } from "@/features/people/components/worker-profile/worker-profile-view";
import type { EmployeeDetailsDto } from "../employees/employee-roster.types";
import {
  useEmployeeDetailsById,
  useEmployeeReportingLines,
  useMyProfileContext,
  useUpdateMyProfile,
} from "../employees/use-employees";

/** The signed-in person's own record, as its Profile or Performance view. */
export function MyProfile({
  view: recordView = "profile",
}: {
  view?: "profile" | "performance";
}) {
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations("profile.self");
  const say = useSay("profile");
  const locale = useLocale();
  const showPerformance = canEnterPerformance(user);
  if (recordView === "performance" && !authLoading && !showPerformance)
    notFound();
  const employeeId = user?.employeeId ?? null;
  const canViewProfile = !!employeeId;
  const [editing, setEditing] = useState(false);

  // The field policy every member may read (fusion-settings): no settings permission needed.
  const { data: settings } = useFieldVisibility({ enabled: canViewProfile });

  const {
    data: details,
    error,
    isLoading,
  } = useEmployeeDetailsById(canViewProfile ? employeeId : null);

  const { data: reportingLines } = useEmployeeReportingLines(
    details?.stableEmployeeKey ?? null
  );

  const { data: profileContext, isLoading: isContextLoading } =
    useMyProfileContext(canViewProfile);

  if (authLoading) {
    return <WorkerProfileSkeleton showEyebrow />;
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
    return <WorkerProfileSkeleton showEyebrow />;
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

  const canEditPreferredName =
    user?.employeeId === details.id &&
    settings?.selfService.canEditPreferredName !== false;
  const canEditPhone =
    user?.employeeId === details.id &&
    settings?.selfService.canEditPhone !== false;
  const canEdit = canEditPreferredName || canEditPhone;

  const view = fromSelfDetails(details, reportingLines, {
    timeline: profileContext?.timeline,
    access: profileContext?.access ?? null,
  }, { say, locale });
  const accessState = isContextLoading
    ? ("loading" as const)
    : view.access
      ? ("ready" as const)
      : undefined;
  const truncatedReports = view.directReportCount > 5;

  return (
    <>
      <WorkerProfile
        view={view}
        eyebrow={t("eyebrow")}
        accessState={accessState}
        timelineLoading={isContextLoading}
        headerActions={
          canEdit ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> {t("edit")}
            </Button>
          ) : undefined
        }
        viewSwitcher={
          showPerformance ? (
            <RecordViewSwitcher
              profileHref="/profile"
              performanceHref="/profile/performance"
              current={recordView}
            />
          ) : undefined
        }
        reportsFooter={
          truncatedReports ? (
            <Button
              asChild
              variant="link"
              size="sm"
              className="mt-3 h-auto p-0"
            >
              <Link href="/team">
                {t("viewAll", { count: view.directReportCount })}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      >
        {recordView === "performance" && showPerformance ? (
          <PerformanceRecordView employeeId={details.id} />
        ) : undefined}
      </WorkerProfile>
      {editing ? (
        <EditMyDetailsDialog
          open
          onOpenChange={setEditing}
          details={details}
          canEditPreferredName={canEditPreferredName}
          canEditPhone={canEditPhone}
        />
      ) : null}
    </>
  );
}

function EditMyDetailsDialog({
  open,
  onOpenChange,
  details,
  canEditPreferredName,
  canEditPhone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: EmployeeDetailsDto;
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}) {
  const update = useUpdateMyProfile();
  const t = useTranslations("profile.self");
  const english = useLocale() === "en";
  const [preferredName, setPreferredName] = useState(
    details.preferredName ?? ""
  );
  const [phone, setPhone] = useState(details.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const normalizedPreferredName = preferredName.trim() || null;
  const normalizedPhone = phone.trim() || null;
  const changed =
    (canEditPreferredName &&
      normalizedPreferredName !== details.preferredName) ||
    (canEditPhone && normalizedPhone !== details.phone);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        employeeId: details.id,
        expectedVersion: details.version,
        preferredName: canEditPreferredName
          ? normalizedPreferredName
          : undefined,
        phone: canEditPhone ? normalizedPhone : undefined,
      });
      toast.success(t("updated"));
      onOpenChange(false);
    } catch (cause) {
      setError(
        english && cause instanceof Error && cause.message.trim()
          ? cause.message
          : t("failed")
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !update.isLoading && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-3">
          {canEditPreferredName ? (
            <div className="space-y-2">
              <Label htmlFor="my-preferred-name">{t("preferredName")}</Label>
              <Input
                id="my-preferred-name"
                value={preferredName}
                maxLength={100}
                onChange={(event) => setPreferredName(event.target.value)}
              />
              <p className="type-meta text-muted-foreground">
                {t("preferredNameHint")}
              </p>
            </div>
          ) : null}
          {canEditPhone ? (
            <div className="space-y-2">
              <Label htmlFor="my-phone">{t("phone")}</Label>
              <Input
                id="my-phone"
                value={phone}
                maxLength={50}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          ) : null}
          {error ? (
            <p
              className="rounded-control bg-danger/10 px-3 py-2 type-meta font-medium text-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isLoading}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!changed || update.isLoading}
          >
            {update.isLoading ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
