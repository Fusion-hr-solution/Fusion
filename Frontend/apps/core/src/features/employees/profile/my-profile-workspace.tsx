"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  cn,
} from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { Mail, MapPin, Pencil, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  Monogram,
  PersonIdentity,
  PersonRelationship,
  formatWorkforceDate,
} from "@/features/people/components/workforce-ui";
import { useUpdateMyProfile } from "@/app/(pages)/employees/use-employees";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
} from "@/app/(pages)/employees/employee-roster.types";

export function MyProfileWorkspace({
  details,
  reportingLines,
  canEditPreferredName,
  canEditPhone,
}: {
  details: EmployeeDetailsDto;
  reportingLines?: EmployeeReportingLinesDto;
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const assignment = details.currentWorkAssignment;
  const employment = details.currentEmployment;
  const manager = details.currentManager;
  const directReports = reportingLines?.directReports ?? [];
  const workContext = [assignment?.jobTitle, assignment?.orgUnitName]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageContainer width="wide" className="max-w-6xl space-y-10 pb-14">
      <header className="grid gap-8 border-b pb-9 md:grid-cols-[minmax(0,1fr)_20rem] md:items-end">
        <div className="flex min-w-0 items-center gap-5 sm:gap-7">
          <Monogram
            name={details.displayName}
            size="xl"
            accent
            className="size-20 text-2xl sm:size-24 sm:text-3xl"
          />
          <div className="min-w-0">
            <p className="type-eyebrow text-muted-foreground">My profile</p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {details.displayName}
            </h1>
            {workContext ? (
              <p className="mt-2 type-body text-muted-foreground">
                {workContext}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 type-meta text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden />
                {details.email}
              </span>
              {details.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" aria-hidden />
                  {details.phone}
                </span>
              ) : null}
              {assignment?.workLocation ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  {assignment.workLocation}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <PersonRelationship
          label="Reports to"
          name={manager?.managerFullName}
          detail={manager?.managerEmail}
          href={
            manager ? `/core/people/${manager.managerEmployeeId}` : undefined
          }
          emptyLabel="No manager assigned"
        />
      </header>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <ProfileSection
          eyebrow="Managed by you"
          title="Personal details"
          action={
            canEditPreferredName || canEditPhone ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1.5 size-3.5" aria-hidden /> Edit
              </Button>
            ) : undefined
          }
        >
          <ProfileFact
            label="Preferred name"
            value={details.preferredName || "Not set"}
            quiet={!details.preferredName}
          />
          <ProfileFact
            label="Phone"
            value={details.phone || "Not set"}
            quiet={!details.phone}
          />
        </ProfileSection>

        <ProfileSection eyebrow="Managed by HR" title="Work details">
          <ProfileFact
            label="Job title"
            value={assignment?.jobTitle || "Not assigned"}
            quiet={!assignment?.jobTitle}
          />
          <ProfileFact
            label="Organization"
            value={assignment?.orgUnitName || "Not assigned"}
            quiet={!assignment?.orgUnitName}
          />
          <ProfileFact
            label="Work location"
            value={assignment?.workLocation || "Not set"}
            quiet={!assignment?.workLocation}
          />
          {employment?.employmentType ? (
            <ProfileFact
              label="Employment"
              value={formatEnum(employment.employmentType)}
            />
          ) : null}
          <ProfileFact
            label="Joined"
            value={
              formatWorkforceDate(employment?.effectiveFrom, {
                month: "long",
              }) || "Not set"
            }
            quiet={!employment?.effectiveFrom}
          />
          {details.employeeNumber ? (
            <ProfileFact
              label="Employee number"
              value={details.employeeNumber}
              code
            />
          ) : null}
        </ProfileSection>
      </div>

      {directReports.length > 0 ? (
        <section className="border-t pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="type-eyebrow text-muted-foreground">Your team</p>
              <h2 className="mt-1 type-title text-foreground">
                {directReports.length} direct{" "}
                {directReports.length === 1 ? "report" : "reports"}
              </h2>
            </div>
            <p className="type-meta text-muted-foreground">
              People who currently report to you
            </p>
          </div>
          <div className="mt-5 grid border-y md:grid-cols-2 md:divide-x">
            {directReports.map(({ employee }, index) => (
              <div
                key={employee.id}
                className={cn(
                  "px-4 py-4",
                  index > 0 && "border-t",
                  index === 1 && "md:border-t-0"
                )}
              >
                <PersonIdentity
                  name={
                    employee.displayName ||
                    employee.fullName ||
                    `${employee.firstName} ${employee.lastName}`
                  }
                  email={employee.email}
                  jobTitle={employee.jobTitle}
                  organization={employee.orgUnitName}
                  employeeNumber={employee.employeeNumber}
                  href={`/core/people/${employee.id}`}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {editing ? (
        <EditMyDetailsDialog
          open
          onOpenChange={setEditing}
          details={details}
          canEditPreferredName={canEditPreferredName}
          canEditPhone={canEditPhone}
        />
      ) : null}
    </PageContainer>
  );
}

function ProfileSection({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b pb-3">
        <div>
          <p className="type-eyebrow text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-1 type-title text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <dl className="divide-y">{children}</dl>
    </section>
  );
}

function ProfileFact({
  label,
  value,
  quiet = false,
  code = false,
}: {
  label: string;
  value: string;
  quiet?: boolean;
  code?: boolean;
}) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 py-3">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd
        className={
          quiet
            ? "type-body text-muted-foreground"
            : code
              ? "type-code text-sm text-foreground"
              : "type-body text-foreground"
        }
      >
        {value}
      </dd>
    </div>
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
    <Dialog
      open={open}
      onOpenChange={(next) => !update.isLoading && onOpenChange(next)}
    >
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
          <Button
            onClick={() => void save()}
            disabled={!changed || update.isLoading}
          >
            {update.isLoading ? "Saving" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatEnum(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
