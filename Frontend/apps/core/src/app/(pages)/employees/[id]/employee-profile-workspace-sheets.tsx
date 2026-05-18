"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type {
  EmployeeOrgUnitOption,
  EmployeeProfileDto,
} from "../employee-roster.types";
import {
  useDeactivateEmployee,
  useEmployeeOrgUnitOptions,
  useUpdateEmployeeRecord,
} from "../use-employees";

interface EmployeeProfileSheetProps {
  profile: EmployeeProfileDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmployeeIdentityEditSheetProps extends EmployeeProfileSheetProps {
  showPhone: boolean;
  requirePhone: boolean;
}

interface EmployeeStatusSheetProps extends EmployeeProfileSheetProps {
  onManageReportingRelationship: () => void;
}

interface IdentityFormValues {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface EmploymentFormValues {
  jobTitle: string;
  hireDate: string;
  workLocation: string;
  employmentType: string;
}

interface OrganizationFormValues {
  orgUnitId: string;
}

interface EmployeeEmploymentEditSheetProps extends EmployeeProfileSheetProps {
  showJobTitle: boolean;
  showHireDate: boolean;
  showWorkLocation: boolean;
  showEmploymentType: boolean;
  requireJobTitle: boolean;
  requireHireDate: boolean;
  requireWorkLocation: boolean;
  requireEmploymentType: boolean;
}

function getMutationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412) {
      return "This employee record changed in another session. Refresh the profile and try again.";
    }

    return error.errors[0] ?? error.message;
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred. Please try again.";
}

function getDateInputValue(value: string) {
  const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    return isoDate[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toApiHireDate(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function formatActiveDirectReportCount(count: number) {
  if (count === 1) {
    return "1 active direct report";
  }

  return `${count} active direct reports`;
}

function getOrgUnitDisplayLabel(option: EmployeeOrgUnitOption) {
  return `${option.name} · ${option.code}`;
}

function isTextPresent(value: string | null | undefined) {
  return !!value?.trim();
}

function ProfileSheetFrame({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function ProfileSheetActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
      {children}
    </div>
  );
}

export function EmployeeIdentityEditSheet({
  profile,
  open,
  onOpenChange,
  showPhone,
  requirePhone,
}: EmployeeIdentityEditSheetProps) {
  const updateEmployeeRecord = useUpdateEmployeeRecord();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<IdentityFormValues>({
    defaultValues: {
      employeeNumber: profile.employeeNumber ?? "",
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      employeeNumber: profile.employeeNumber ?? "",
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? "",
    });
    setSubmitError(null);
  }, [
    form,
    open,
    profile.email,
    profile.employeeNumber,
    profile.firstName,
    profile.lastName,
    profile.phone,
  ]);

  async function handleSubmit(values: IdentityFormValues) {
    setSubmitError(null);

    try {
      await updateEmployeeRecord.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
        employeeNumber: values.employeeNumber.trim() || null,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        ...(showPhone ? { phone: values.phone.trim() || null } : {}),
      });

      toast.success("Identity and contact details updated.");
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  return (
    <ProfileSheetFrame
      title="Edit identity & contact"
      description="Update the employee's primary identity fields used across Core."
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="identity-employee-number">Employee number</Label>
            <Input
              id="identity-employee-number"
              autoComplete="off"
              maxLength={64}
              placeholder="Optional stable employee reference"
              {...form.register("employeeNumber")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="identity-first-name">First name</Label>
            <Input
              id="identity-first-name"
              autoComplete="given-name"
              {...form.register("firstName", {
                required: "First name is required.",
              })}
            />
            {form.formState.errors.firstName ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.firstName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="identity-last-name">Last name</Label>
            <Input
              id="identity-last-name"
              autoComplete="family-name"
              {...form.register("lastName", {
                required: "Last name is required.",
              })}
            />
            {form.formState.errors.lastName ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.lastName.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="identity-email">Work email</Label>
          <Input
            id="identity-email"
            type="email"
            autoComplete="email"
            {...form.register("email", {
              required: "Work email is required.",
            })}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        {showPhone ? (
          <div className="space-y-2">
            <Label htmlFor="identity-phone">Phone</Label>
            <Input
              id="identity-phone"
              autoComplete="tel"
              placeholder="e.g. +44 7700 900123"
              {...form.register(
                "phone",
                requirePhone
                  ? {
                      validate: (value) =>
                        value.trim().length > 0 || "Phone is required.",
                    }
                  : undefined
              )}
            />
            {form.formState.errors.phone ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Update failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <ProfileSheetActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateEmployeeRecord.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || updateEmployeeRecord.isLoading}
          >
            {updateEmployeeRecord.isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </ProfileSheetActions>
      </form>
    </ProfileSheetFrame>
  );
}

export function EmployeeEmploymentEditSheet({
  profile,
  open,
  onOpenChange,
  showJobTitle,
  showHireDate,
  showWorkLocation,
  showEmploymentType,
  requireJobTitle,
  requireHireDate,
  requireWorkLocation,
  requireEmploymentType,
}: EmployeeEmploymentEditSheetProps) {
  const updateEmployeeRecord = useUpdateEmployeeRecord();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<EmploymentFormValues>({
    defaultValues: {
      jobTitle: profile.jobTitle ?? "",
      hireDate: getDateInputValue(profile.hireDate),
      workLocation: profile.workLocation ?? "",
      employmentType: profile.employmentType ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      jobTitle: profile.jobTitle ?? "",
      hireDate: getDateInputValue(profile.hireDate),
      workLocation: profile.workLocation ?? "",
      employmentType: profile.employmentType ?? "",
    });
    setSubmitError(null);
  }, [
    form,
    open,
    profile.employmentType,
    profile.hireDate,
    profile.jobTitle,
    profile.workLocation,
  ]);

  async function handleSubmit(values: EmploymentFormValues) {
    setSubmitError(null);

    try {
      const updatePayload = {
        employeeId: profile.id,
        expectedVersion: profile.version,
        ...(showJobTitle ? { jobTitle: values.jobTitle.trim() } : {}),
        ...(showHireDate ? { hireDate: toApiHireDate(values.hireDate) } : {}),
        ...(showWorkLocation
          ? { workLocation: values.workLocation.trim() || null }
          : {}),
        ...(showEmploymentType
          ? { employmentType: values.employmentType.trim() || null }
          : {}),
      };

      await updateEmployeeRecord.mutateAsync({
        ...updatePayload,
      });

      toast.success("Employment details updated.");
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  return (
    <ProfileSheetFrame
      title="Edit employment details"
      description="Maintain the core employment facts used throughout the workforce record."
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
      >
        {showJobTitle ? (
          <div className="space-y-2">
            <Label htmlFor="employment-job-title">Job title</Label>
            <Input
              id="employment-job-title"
              placeholder="e.g. Senior HR Manager"
              {...form.register(
                "jobTitle",
                requireJobTitle
                  ? {
                      validate: (value) =>
                        value.trim().length > 0 || "Job title is required.",
                    }
                  : undefined
              )}
            />
            {form.formState.errors.jobTitle ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.jobTitle.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {showHireDate ? (
          <div className="space-y-2">
            <Label htmlFor="employment-hire-date">Hire date</Label>
            <Input
              id="employment-hire-date"
              type="date"
              {...form.register(
                "hireDate",
                showHireDate && requireHireDate
                  ? {
                      required: "Hire date is required.",
                    }
                  : undefined
              )}
            />
            {form.formState.errors.hireDate ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.hireDate.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {showWorkLocation ? (
          <div className="space-y-2">
            <Label htmlFor="employment-work-location">Work location</Label>
            <Input
              id="employment-work-location"
              placeholder="e.g. London HQ"
              {...form.register(
                "workLocation",
                requireWorkLocation
                  ? {
                      validate: (value) =>
                        value.trim().length > 0 || "Work location is required.",
                    }
                  : undefined
              )}
            />
            {form.formState.errors.workLocation ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.workLocation.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {showEmploymentType ? (
          <div className="space-y-2">
            <Label htmlFor="employment-employment-type">Employment type</Label>
            <Input
              id="employment-employment-type"
              placeholder="e.g. Full-time"
              {...form.register(
                "employmentType",
                requireEmploymentType
                  ? {
                      validate: (value) =>
                        value.trim().length > 0 || "Employment type is required.",
                    }
                  : undefined
              )}
            />
            {form.formState.errors.employmentType ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.employmentType.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Update failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <ProfileSheetActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateEmployeeRecord.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || updateEmployeeRecord.isLoading}
          >
            {updateEmployeeRecord.isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </ProfileSheetActions>
      </form>
    </ProfileSheetFrame>
  );
}

export function EmployeeOrganizationEditSheet({
  profile,
  open,
  onOpenChange,
}: EmployeeProfileSheetProps) {
  const updateEmployeeRecord = useUpdateEmployeeRecord();
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<OrganizationFormValues>({
    defaultValues: {
      orgUnitId: profile.orgUnitId ?? "",
    },
  });
  const orgUnitOptionsQuery = useEmployeeOrgUnitOptions({
    search,
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      orgUnitId: profile.orgUnitId ?? "",
    });
    setSearch("");
    setSubmitError(null);
  }, [form, open, profile.orgUnitId]);

  const orgUnits = orgUnitOptionsQuery.data?.items ?? [];

  async function handleSubmit(values: OrganizationFormValues) {
    setSubmitError(null);

    try {
      await updateEmployeeRecord.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
        orgUnitId: values.orgUnitId || null,
      });

      toast.success("Organization assignment updated.");
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  const selectedOrgUnitId = form.watch("orgUnitId");

  return (
    <ProfileSheetFrame
      title="Edit organization assignment"
      description="Assign the employee to the live org-unit structure used across Core."
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
      >
        <div className="space-y-2">
          <Label htmlFor="organization-search">Find org unit</Label>
          <Input
            id="organization-search"
            value={search}
            placeholder="Search by unit name or code"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Assignment</Label>
          <div className="overflow-hidden rounded-lg border">
            <button
              type="button"
              className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-muted/40 ${
                selectedOrgUnitId === "" ? "bg-muted/50" : ""
              }`}
              onClick={() =>
                form.setValue("orgUnitId", "", { shouldDirty: true })
              }
            >
              <div className="space-y-1">
                <p className="font-medium">Not assigned</p>
                <p className="text-xs text-muted-foreground">
                  Remove this employee from the current org-unit assignment.
                </p>
              </div>
              {selectedOrgUnitId === "" ? (
                <span className="text-xs font-medium text-foreground">
                  Selected
                </span>
              ) : null}
            </button>

            <div className="border-t">
              {orgUnitOptionsQuery.isLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Loading active org units...
                </div>
              ) : orgUnitOptionsQuery.error ? (
                <div className="px-4 py-3 text-sm text-destructive">
                  {orgUnitOptionsQuery.error.message ||
                    "Unable to load org units right now."}
                </div>
              ) : orgUnits.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No active org units matched this search.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y">
                  {orgUnits.map((option) => {
                    const isSelected = selectedOrgUnitId === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-muted/40 ${
                          isSelected ? "bg-muted/50" : ""
                        }`}
                        onClick={() =>
                          form.setValue("orgUnitId", option.id, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <div className="space-y-1">
                          <p className="font-medium">
                            {getOrgUnitDisplayLabel(option)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {option.type}
                            {isTextPresent(option.parentName)
                              ? ` · Reports into ${option.parentName}`
                              : " · Root unit"}
                          </p>
                        </div>
                        {isSelected ? (
                          <span className="text-xs font-medium text-foreground">
                            Selected
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {submitError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Update failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <ProfileSheetActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateEmployeeRecord.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || updateEmployeeRecord.isLoading}
          >
            {updateEmployeeRecord.isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </ProfileSheetActions>
      </form>
    </ProfileSheetFrame>
  );
}

export function EmployeeStatusSheet({
  profile,
  open,
  onOpenChange,
  onManageReportingRelationship,
}: EmployeeStatusSheetProps) {
  const deactivateEmployee = useDeactivateEmployee();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasActiveDirectReports =
    profile.status === "Active" && profile.directReportCount > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    setSubmitError(null);
  }, [open, profile.id, profile.version]);

  async function handleDeactivate() {
    setSubmitError(null);

    try {
      await deactivateEmployee.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
      });

      toast.success("Employee deactivated.");
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  return (
    <ProfileSheetFrame
      title="Manage employment status"
      description="Review the employee's current status and handle deactivation safely within the workforce record."
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Current status</p>
              <p className="text-muted-foreground">
                {profile.status === "Active"
                  ? "Active employees remain visible in roster, reporting, and assignment workflows."
                  : "This employee is already inactive. Reactivation is not available from this workspace."}
              </p>
            </div>
          </div>
        </div>

        {profile.status === "Inactive" ? (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Employee is inactive</AlertTitle>
            <AlertDescription>
              This record stays available for review, but reactivation is not
              available from this workspace.
            </AlertDescription>
          </Alert>
        ) : hasActiveDirectReports ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Deactivation is blocked</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                This employee currently manages{" "}
                {formatActiveDirectReportCount(profile.directReportCount)}.
                Reassign or clear those relationships before deactivation.
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onManageReportingRelationship();
                  }}
                >
                  Open reporting relationship
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Deactivate this employee</AlertTitle>
            <AlertDescription>
              Deactivation keeps the employee record intact, but marks the
              employee inactive for Core workforce operations.
            </AlertDescription>
          </Alert>
        )}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Status update failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <ProfileSheetActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deactivateEmployee.isLoading}
          >
            Close
          </Button>
          {profile.status === "Active" && !hasActiveDirectReports ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeactivate()}
              disabled={deactivateEmployee.isLoading}
            >
              {deactivateEmployee.isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Deactivating
                </>
              ) : (
                "Deactivate employee"
              )}
            </Button>
          ) : null}
        </ProfileSheetActions>
      </div>
    </ProfileSheetFrame>
  );
}
