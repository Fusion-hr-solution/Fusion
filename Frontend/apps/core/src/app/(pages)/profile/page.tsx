"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, User } from "lucide-react";
import { useAuth } from "@repo/auth";
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
import { PageContainer, PageEmpty, PageError, PageHeader } from "@repo/ds/shell";
import { toast } from "sonner";
import { useTenantSettings } from "@/features/settings/api/use-tenant-settings";
import { WorkerProfile } from "@/features/people/components/worker-profile/worker-profile";
import { WorkerProfileSkeleton } from "@/features/people/components/worker-profile/worker-profile-skeleton";
import { fromSelfDetails } from "@/features/people/components/worker-profile/worker-profile-view";
import type { EmployeeDetailsDto } from "../employees/employee-roster.types";
import {
  useEmployeeDetailsById,
  useEmployeeReportingLines,
  useMyProfileContext,
  useUpdateMyProfile,
} from "../employees/use-employees";

export default function MyProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const canViewProfile = !!employeeId;
  const [editing, setEditing] = useState(false);

  const { data: settings } = useTenantSettings(canViewProfile);

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
        <PageHeader title="Profile" description="No linked employee record." />
        <PageEmpty
          icon={User}
          title="No linked employee profile"
          description="Contact a tenant HR administrator to link your record."
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
        <PageHeader title="Profile" />
        <PageError
          title="Your profile could not be found"
          description="Your linked employee profile is not available right now."
        />
      </PageContainer>
    );
  }

  if (!details) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Profile" description="Profile unavailable." />
        <PageEmpty
          icon={User}
          title="Unable to load profile"
          description="Your employee profile is not available right now."
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
  });
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
        eyebrow="Profile"
        accessState={accessState}
        timelineLoading={isContextLoading}
        headerActions={
          canEdit ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Edit details
            </Button>
          ) : undefined
        }
        reportsFooter={
          truncatedReports ? (
            <Button asChild variant="link" size="sm" className="mt-3 h-auto p-0">
              <Link href="/team">
                View all {view.directReportCount} reports
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      />
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
  const [preferredName, setPreferredName] = useState(details.preferredName ?? "");
  const [phone, setPhone] = useState(details.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const normalizedPreferredName = preferredName.trim() || null;
  const normalizedPhone = phone.trim() || null;
  const changed =
    (canEditPreferredName && normalizedPreferredName !== details.preferredName) ||
    (canEditPhone && normalizedPhone !== details.phone);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        employeeId: details.id,
        expectedVersion: details.version,
        preferredName: canEditPreferredName ? normalizedPreferredName : undefined,
        phone: canEditPhone ? normalizedPhone : undefined,
      });
      toast.success("Profile details updated.");
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.trim()
          ? cause.message
          : "Your changes could not be saved."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !update.isLoading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edit personal details</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-3">
          {canEditPreferredName ? (
            <div className="space-y-2">
              <Label htmlFor="my-preferred-name">Preferred name</Label>
              <Input
                id="my-preferred-name"
                value={preferredName}
                maxLength={100}
                onChange={(event) => setPreferredName(event.target.value)}
              />
              <p className="type-meta text-muted-foreground">
                Used as your display name across Fusion.
              </p>
            </div>
          ) : null}
          {canEditPhone ? (
            <div className="space-y-2">
              <Label htmlFor="my-phone">Phone</Label>
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
              className="border-l-2 border-danger bg-danger/5 px-3 py-2 type-meta font-medium text-danger"
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
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!changed || update.isLoading}>
            {update.isLoading ? "Saving" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
