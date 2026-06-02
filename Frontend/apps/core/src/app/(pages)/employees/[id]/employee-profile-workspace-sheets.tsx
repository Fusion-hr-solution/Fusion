"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { AlertTriangle, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import type {
  EmployeeOrgUnitOption,
  EmployeeProfileDto,
} from "../employee-roster.types";
import {
  useEmployeeOrgUnitOptions,
  useEmployeeReportingLines,
  useUpdateEmployeeRecord,
} from "../use-employees";
import { EmployeeConfirmDialog } from "../employee-confirm-dialog";
import { ManagerChangeSection } from "../employee-reporting-lines-sheet";

interface EmployeeProfileSheetProps {
  profile: EmployeeProfileDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmployeeEditSheetProps extends EmployeeProfileSheetProps {
  employeeId: string;
  defaultTab?: string;
  showPhone: boolean;
  requirePhone: boolean;
  showJobTitle: boolean;
  showHireDate: boolean;
  showWorkLocation: boolean;
  showEmploymentType: boolean;
  requireJobTitle: boolean;
  requireHireDate: boolean;
  requireWorkLocation: boolean;
  requireEmploymentType: boolean;
}

interface IdentityFormValues {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  jobTitle: string;
  hireDate: string;
  workLocation: string;
  employmentType: string;
}

function getMutationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412) {
      return "This record was changed by another user. Refresh and try again.";
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
  return `${value}T00:00:00.000Z`;
}

function getOrgUnitDisplayLabel(option: EmployeeOrgUnitOption) {
  return `${option.name} · ${option.code}`;
}

function isTextPresent(value: string | null | undefined) {
  return !!value?.trim();
}

const DEFAULT_ORG_UNIT_SUGGESTION_COUNT = 5;

type EmployeeEditTabKey = "personal" | "work" | "manager" | "organization";

function getEmptyDirtyTabs() {
  return {
    personal: false,
    work: false,
    manager: false,
    organization: false,
  } satisfies Record<EmployeeEditTabKey, boolean>;
}

// ── EmployeeEditTabLayout (reusable) ─────────────────────────────────────

function EmployeeEditTabLayout({
  error,
  footer,
  children,
}: {
  error?: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
      {error ? <div className="mt-4">{error}</div> : null}
      <DialogFooter className="shrink-0 border-t pt-4">{footer}</DialogFooter>
    </>
  );
}

// ── EmployeeEditDialog (unified) ──────────────────────────────────────────

export function EmployeeEditDialog({
  profile,
  employeeId,
  open,
  onOpenChange,
  defaultTab = "personal",
  showPhone,
  requirePhone,
  showJobTitle,
  showHireDate,
  showWorkLocation,
  showEmploymentType,
  requireJobTitle,
  requireHireDate,
  requireWorkLocation,
  requireEmploymentType,
}: EmployeeEditSheetProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [dirtyTabs, setDirtyTabs] = useState(getEmptyDirtyTabs);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const hasUnsavedChanges = Object.values(dirtyTabs).some(Boolean);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      return;
    }

    setDirtyTabs(getEmptyDirtyTabs());
    setShowDiscardConfirm(false);
  }, [open, defaultTab]);

  function setDirtyTab(tab: EmployeeEditTabKey, isDirty: boolean) {
    setDirtyTabs((current) =>
      current[tab] === isDirty ? current : { ...current, [tab]: isDirty }
    );
  }

  function handleOpenStateChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }

    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenStateChange}>
        <DialogContent
          className="sm:max-w-xl flex flex-col h-[540px] max-h-[85vh]"
          aria-describedby={undefined}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit employee</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="personal" className="flex-1">
                Personal
              </TabsTrigger>
              <TabsTrigger value="work" className="flex-1">
                Work
              </TabsTrigger>
              <TabsTrigger value="manager" className="flex-1">
                Manager
              </TabsTrigger>
              <TabsTrigger value="organization" className="flex-1">
                Organization
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="min-h-0 flex flex-col">
              <PersonalTab
                profile={profile}
                open={open}
                showPhone={showPhone}
                requirePhone={requirePhone}
                onDirtyChange={(isDirty) => setDirtyTab("personal", isDirty)}
              />
            </TabsContent>

            <TabsContent value="work" className="min-h-0 flex flex-col">
              <WorkTab
                profile={profile}
                open={open}
                showJobTitle={showJobTitle}
                showHireDate={showHireDate}
                showWorkLocation={showWorkLocation}
                showEmploymentType={showEmploymentType}
                requireJobTitle={requireJobTitle}
                requireHireDate={requireHireDate}
                requireWorkLocation={requireWorkLocation}
                requireEmploymentType={requireEmploymentType}
                onDirtyChange={(isDirty) => setDirtyTab("work", isDirty)}
              />
            </TabsContent>

            <TabsContent value="manager" className="min-h-0 flex flex-col">
              <ManagerTab
                employeeId={employeeId}
                showJobTitle={showJobTitle}
                onDirtyChange={(isDirty) => setDirtyTab("manager", isDirty)}
              />
            </TabsContent>

            <TabsContent value="organization" className="min-h-0 flex flex-col">
              <OrganizationTab
                profile={profile}
                open={open}
                onDirtyChange={(isDirty) =>
                  setDirtyTab("organization", isDirty)
                }
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <EmployeeConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="Discard changes?"
        description="Your unsaved edits will be lost."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setDirtyTabs(getEmptyDirtyTabs());
          setShowDiscardConfirm(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

// ── PersonalTab ─────────────────────────────────────────────────────────────

function PersonalTab({
  profile,
  showPhone,
  requirePhone,
  open,
  onDirtyChange,
}: {
  profile: EmployeeProfileDto;
  showPhone: boolean;
  requirePhone: boolean;
  open: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const updateEmployeeRecord = useUpdateEmployeeRecord();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const form = useForm<IdentityFormValues>({
    defaultValues: {
      employeeNumber: profile.employeeNumber ?? "",
      firstName: profile.firstName,
      lastName: profile.lastName,
      preferredName: profile.preferredName ?? "",
      email: profile.email,
      phone: profile.phone ?? "",
      jobTitle: "",
      hireDate: "",
      workLocation: "",
      employmentType: "",
    },
  });

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) return;

    form.reset({
      employeeNumber: profile.employeeNumber ?? "",
      firstName: profile.firstName,
      lastName: profile.lastName,
      preferredName: profile.preferredName ?? "",
      email: profile.email,
      phone: profile.phone ?? "",
      jobTitle: "",
      hireDate: "",
      workLocation: "",
      employmentType: "",
    });
    setSubmitError(null);
  }, [
    form,
    open,
    profile.employeeNumber,
    profile.firstName,
    profile.lastName,
    profile.preferredName,
    profile.email,
    profile.phone,
  ]);

  useEffect(() => {
    onDirtyChange(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  async function handleSubmit(values: IdentityFormValues) {
    setSubmitError(null);
    try {
      await updateEmployeeRecord.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
        employeeNumber: values.employeeNumber.trim() || null,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        preferredName: values.preferredName,
        email: values.email.trim().toLowerCase(),
        ...(showPhone ? { phone: values.phone.trim() || null } : {}),
      });
      form.reset({
        employeeNumber: values.employeeNumber.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        preferredName: values.preferredName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        jobTitle: "",
        hireDate: "",
        workLocation: "",
        employmentType: "",
      });
      toast.success("Details updated.");
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
    >
      <EmployeeEditTabLayout
        error={
          submitError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Update failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : undefined
        }
        footer={
          <Button
            type="submit"
            disabled={!form.formState.isDirty || updateEmployeeRecord.isLoading}
          >
            {updateEmployeeRecord.isLoading
              ? "Saving..."
              : "Save personal details"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="personal-employee-number">Employee number</Label>
              <Input
                id="personal-employee-number"
                autoComplete="off"
                maxLength={64}
                placeholder="e.g. EMP001"
                {...form.register("employeeNumber")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="personal-first-name">First name</Label>
              <Input
                id="personal-first-name"
                autoComplete="given-name"
                placeholder="e.g. John"
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
              <Label htmlFor="personal-last-name">Last name</Label>
              <Input
                id="personal-last-name"
                autoComplete="family-name"
                placeholder="e.g. Smith"
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="personal-preferred-name">Preferred name</Label>
              <Input
                id="personal-preferred-name"
                autoComplete="nickname"
                maxLength={100}
                placeholder="e.g. Jordy"
                {...form.register("preferredName")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="personal-email">Work email</Label>
            <Input
              id="personal-email"
              type="email"
              autoComplete="email"
              placeholder="e.g. john.smith@company.com"
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
              <Label htmlFor="personal-phone">Phone</Label>
              <Input
                id="personal-phone"
                autoComplete="tel"
                placeholder="e.g. +1 555 123 4567"
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
        </div>
      </EmployeeEditTabLayout>
    </form>
  );
}

// ── WorkTab ─────────────────────────────────────────────────────────────────

function WorkTab({
  profile,
  open,
  showJobTitle,
  showHireDate,
  showWorkLocation,
  showEmploymentType,
  requireJobTitle,
  requireHireDate,
  requireWorkLocation,
  requireEmploymentType,
  onDirtyChange,
}: {
  profile: EmployeeProfileDto;
  open: boolean;
  showJobTitle: boolean;
  showHireDate: boolean;
  showWorkLocation: boolean;
  showEmploymentType: boolean;
  requireJobTitle: boolean;
  requireHireDate: boolean;
  requireWorkLocation: boolean;
  requireEmploymentType: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const updateEmployeeRecord = useUpdateEmployeeRecord();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const form = useForm<IdentityFormValues>({
    defaultValues: {
      employeeNumber: "",
      firstName: "",
      lastName: "",
      preferredName: "",
      email: "",
      phone: "",
      jobTitle: profile.jobTitle ?? "",
      hireDate: getDateInputValue(profile.hireDate),
      workLocation: profile.workLocation ?? "",
      employmentType: profile.employmentType ?? "",
    },
  });

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    form.reset({
      employeeNumber: "",
      firstName: "",
      lastName: "",
      preferredName: "",
      email: "",
      phone: "",
      jobTitle: profile.jobTitle ?? "",
      hireDate: getDateInputValue(profile.hireDate),
      workLocation: profile.workLocation ?? "",
      employmentType: profile.employmentType ?? "",
    });
    setSubmitError(null);
  }, [
    form,
    open,
    profile.jobTitle,
    profile.hireDate,
    profile.workLocation,
    profile.employmentType,
  ]);

  useEffect(() => {
    onDirtyChange(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  async function handleSubmit(values: IdentityFormValues) {
    setSubmitError(null);
    try {
      await updateEmployeeRecord.mutateAsync({
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
      });
      form.reset({
        employeeNumber: "",
        firstName: "",
        lastName: "",
        preferredName: "",
        email: "",
        phone: "",
        jobTitle: values.jobTitle.trim(),
        hireDate: values.hireDate,
        workLocation: values.workLocation.trim(),
        employmentType: values.employmentType.trim(),
      });
      toast.success("Details updated.");
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  const showAnyField =
    showJobTitle || showHireDate || showWorkLocation || showEmploymentType;

  if (!showAnyField) return null;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
    >
      <EmployeeEditTabLayout
        error={
          submitError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Update failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : undefined
        }
        footer={
          <Button
            type="submit"
            disabled={!form.formState.isDirty || updateEmployeeRecord.isLoading}
          >
            {updateEmployeeRecord.isLoading ? "Saving..." : "Save work details"}
          </Button>
        }
      >
        <div className="space-y-4">
          {showJobTitle ? (
            <div className="space-y-2">
              <Label htmlFor="work-job-title">Job title</Label>
              <Input
                id="work-job-title"
                placeholder="e.g. Software Engineer"
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
              <Label htmlFor="work-hire-date">Hire date</Label>
              <Input
                id="work-hire-date"
                type="date"
                {...form.register(
                  "hireDate",
                  requireHireDate
                    ? { required: "Hire date is required." }
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
              <Label htmlFor="work-location">Work location</Label>
              <Input
                id="work-location"
                placeholder="e.g. London"
                {...form.register(
                  "workLocation",
                  requireWorkLocation
                    ? {
                        validate: (value) =>
                          value.trim().length > 0 ||
                          "Work location is required.",
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
              <Label htmlFor="work-employment-type">Employment type</Label>
              <Input
                id="work-employment-type"
                placeholder="e.g. Full-time"
                {...form.register(
                  "employmentType",
                  requireEmploymentType
                    ? {
                        validate: (value) =>
                          value.trim().length > 0 ||
                          "Employment type is required.",
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
        </div>
      </EmployeeEditTabLayout>
    </form>
  );
}

// ── ManagerTab ─────────────────────────────────────────────────────────────

function ManagerTab({
  employeeId,
  showJobTitle,
  onDirtyChange,
}: {
  employeeId: string;
  showJobTitle: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const { data, error, isLoading } = useEmployeeReportingLines(employeeId);
  const controllerRef = useRef<
    { save: () => void; remove: () => void } | undefined
  >(undefined);
  const [buttonState, setButtonState] = useState({
    canSave: false,
    isSaving: false,
  });

  useEffect(() => {
    onDirtyChange(buttonState.canSave);
  }, [buttonState.canSave, onDirtyChange]);

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Couldn&apos;t load reporting relationship</AlertTitle>
          <AlertDescription>
            {error.message ||
              "Reporting details couldn&apos;t be loaded. Try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const emp = data.employee;
  const hasManager =
    emp.managerId !== null &&
    emp.hierarchyStatus !== "Root" &&
    emp.hierarchyStatus !== "ManagerMissing";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EmployeeEditTabLayout
        footer={
          <Button
            onClick={() => void controllerRef.current?.save()}
            disabled={!buttonState.canSave || buttonState.isSaving}
          >
            {buttonState.isSaving
              ? "Saving..."
              : hasManager
                ? "Change manager"
                : "Assign manager"}
          </Button>
        }
      >
        <ManagerChangeSection
          data={data}
          showJobTitle={showJobTitle}
          embedded
          hideFooter
          controllerRef={controllerRef}
          onButtonStateChange={setButtonState}
        />
      </EmployeeEditTabLayout>
    </div>
  );
}

// ── OrganizationTab ────────────────────────────────────────────────────────

function OrganizationTab({
  profile,
  open,
  onDirtyChange,
}: {
  profile: EmployeeProfileDto;
  open: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const updateEmployeeRecord = useUpdateEmployeeRecord();
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const orgUnitOptionsQuery = useEmployeeOrgUnitOptions({
    search,
    enabled: true,
  });
  const orgUnits = orgUnitOptionsQuery.data?.items ?? [];
  const hasSearch = search.trim().length > 0;
  const visibleOrgUnits = hasSearch
    ? orgUnits
    : orgUnits.slice(0, DEFAULT_ORG_UNIT_SUGGESTION_COUNT);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState(
    profile.orgUnitId ?? ""
  );
  const [selectedOrgUnitName, setSelectedOrgUnitName] = useState<string | null>(
    profile.orgUnitName ?? null
  );
  const [initialOrgUnitId, setInitialOrgUnitId] = useState(
    profile.orgUnitId ?? ""
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const wasOpenRef = useRef(false);
  const hasChanges = selectedOrgUnitId !== initialOrgUnitId;
  const isClearingAssignment = !!initialOrgUnitId && selectedOrgUnitId === "";

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    setSelectedOrgUnitId(profile.orgUnitId ?? "");
    setSelectedOrgUnitName(profile.orgUnitName ?? null);
    setInitialOrgUnitId(profile.orgUnitId ?? "");
    setSearch("");
    setSubmitError(null);
    setShowClearConfirm(false);
  }, [open, profile.orgUnitId, profile.orgUnitName]);

  useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  async function saveOrganizationAssignment() {
    setSubmitError(null);

    try {
      await updateEmployeeRecord.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
        orgUnitId: selectedOrgUnitId || null,
      });
      setInitialOrgUnitId(selectedOrgUnitId);
      toast.success("Organization updated.");
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    } finally {
      setShowClearConfirm(false);
    }
  }

  async function handleSave() {
    if (!hasChanges) {
      return;
    }

    if (isClearingAssignment) {
      setShowClearConfirm(true);
      return;
    }

    await saveOrganizationAssignment();
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <EmployeeEditTabLayout
          error={
            submitError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Update failed</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : undefined
          }
          footer={
            <Button
              onClick={() => void handleSave()}
              disabled={!hasChanges || updateEmployeeRecord.isLoading}
            >
              {updateEmployeeRecord.isLoading
                ? "Saving..."
                : "Save organization"}
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="organization-search"
                value={search}
                placeholder="Search org units..."
                className="pl-8"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {selectedOrgUnitId ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {selectedOrgUnitName ?? "Selected org unit"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedOrgUnitId === initialOrgUnitId
                      ? "Current assignment"
                      : "Pending change"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedOrgUnitId("");
                    setSelectedOrgUnitName(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No org unit assigned.
              </p>
            )}

            <div className="overflow-hidden rounded-lg border">
              {orgUnitOptionsQuery.isLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  {hasSearch ? "Searching..." : "Loading suggestions..."}
                </div>
              ) : orgUnitOptionsQuery.error ? (
                <div className="px-4 py-3 text-sm text-destructive">
                  {orgUnitOptionsQuery.error.message ||
                    "Unable to load org units right now."}
                </div>
              ) : visibleOrgUnits.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {hasSearch
                    ? "No results found."
                    : "No suggested org units available."}
                </div>
              ) : (
                <div className="divide-y">
                  {visibleOrgUnits.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-muted ${
                        selectedOrgUnitId === option.id ? "bg-muted/50" : ""
                      }`}
                      onClick={() => {
                        setSelectedOrgUnitId(option.id);
                        setSelectedOrgUnitName(option.name);
                      }}
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </EmployeeEditTabLayout>
      </div>

      <EmployeeConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Remove organization assignment?"
        description="This clears the current organization assignment."
        confirmLabel="Remove assignment"
        confirmVariant="destructive"
        loading={updateEmployeeRecord.isLoading}
        loadingLabel="Saving..."
        onConfirm={() => void saveOrganizationAssignment()}
      />
    </>
  );
}
