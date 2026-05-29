"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type {
  EmployeeOrgUnitOption,
  EmployeeRosterItem,
} from "./employee-roster.types";
import {
  useCreateEmployeeRecord,
  useEmployeeManagerOptions,
  useEmployeeOrgUnitOptions,
} from "./use-employees";

const EMPLOYMENT_TYPE_OPTIONS = [
  "Full-time",
  "Part-time",
  "Contractor",
  "Intern",
] as const;

interface CreateEmployeeFormValues {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  jobTitle: string;
  workLocation: string;
  employmentType: string;
  managerId: string;
  orgUnitId: string;
}

interface EmployeeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (employeeId: string) => void;
}

function getMutationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return error.errors[0] ?? "An employee with the same identity already exists.";
    }

    return error.errors[0] ?? error.message;
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred. Please try again.";
}

function toApiHireDate(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function getOrgUnitDisplayLabel(option: EmployeeOrgUnitOption) {
  return `${option.name} · ${option.code}`;
}

function getEmployeeDisplayName(employee: EmployeeRosterItem) {
  return `${employee.firstName} ${employee.lastName}`;
}

export function EmployeeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: EmployeeCreateDialogProps) {
  const createEmployee = useCreateEmployeeRecord();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [managerSearch, setManagerSearch] = useState("");
  const [orgUnitSearch, setOrgUnitSearch] = useState("");
  const deferredManagerSearch = useDeferredValue(managerSearch);
  const form = useForm<CreateEmployeeFormValues>({
    defaultValues: {
      employeeNumber: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      hireDate: "",
      jobTitle: "",
      workLocation: "",
      employmentType: EMPLOYMENT_TYPE_OPTIONS[0],
      managerId: "",
      orgUnitId: "",
    },
  });
  const managerOptionsQuery = useEmployeeManagerOptions({
    employeeId: null,
    search: deferredManagerSearch,
    enabled: open,
  });
  const orgUnitOptionsQuery = useEmployeeOrgUnitOptions({
    search: orgUnitSearch,
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      employeeNumber: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      hireDate: "",
      jobTitle: "",
      workLocation: "",
      employmentType: EMPLOYMENT_TYPE_OPTIONS[0],
      managerId: "",
      orgUnitId: "",
    });
    setManagerSearch("");
    setOrgUnitSearch("");
    setSubmitError(null);
  }, [form, open]);

  const managerOptions = managerOptionsQuery.data?.items ?? [];
  const orgUnits = orgUnitOptionsQuery.data?.items ?? [];
  const selectedManagerId = form.watch("managerId");
  const selectedOrgUnitId = form.watch("orgUnitId");
  const selectedManager = useMemo(
    () => managerOptions.find((option) => option.id === selectedManagerId) ?? null,
    [managerOptions, selectedManagerId]
  );
  const selectedOrgUnit = useMemo(
    () => orgUnits.find((option) => option.id === selectedOrgUnitId) ?? null,
    [orgUnits, selectedOrgUnitId]
  );

  async function handleSubmit(values: CreateEmployeeFormValues) {
    setSubmitError(null);

    try {
      const created = await createEmployee.mutateAsync({
        employeeNumber: values.employeeNumber.trim() || null,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() || null,
        hireDate: toApiHireDate(values.hireDate),
        jobTitle: values.jobTitle.trim() || null,
        workLocation: values.workLocation.trim() || null,
        employmentType: values.employmentType.trim() || null,
        managerId: values.managerId || null,
        orgUnitId: values.orgUnitId || null,
      });

      toast.success("Employee created.");
      onOpenChange(false);
      onCreated(created.id);
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Create an employee record directly from Core without starting from a CSV import.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
        >
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">Identity & contact</h3>
              <p className="text-sm text-muted-foreground">
                Core identity details used across roster, profiles, and invitations.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-employee-number">Employee number</Label>
                <Input
                  id="create-employee-number"
                  autoComplete="off"
                  maxLength={64}
                  placeholder="Optional stable employee reference"
                  {...form.register("employeeNumber")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-first-name">First name</Label>
                <Input
                  id="create-first-name"
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
                <Label htmlFor="create-last-name">Last name</Label>
                <Input
                  id="create-last-name"
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

              <div className="space-y-2">
                <Label htmlFor="create-email">Work email</Label>
                <Input
                  id="create-email"
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

              <div className="space-y-2">
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  autoComplete="tel"
                  placeholder="Optional phone number"
                  {...form.register("phone")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-medium">Employment</h3>
              <p className="text-sm text-muted-foreground">
                Employment details that shape the employee profile.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-hire-date">Hire date</Label>
                <Input
                  id="create-hire-date"
                  type="date"
                  {...form.register("hireDate", {
                    required: "Hire date is required.",
                  })}
                />
                {form.formState.errors.hireDate ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.hireDate.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-job-title">Job title</Label>
                <Input
                  id="create-job-title"
                  placeholder="e.g. Senior HR Manager"
                  {...form.register("jobTitle")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-work-location">Work location</Label>
                <Input
                  id="create-work-location"
                  placeholder="e.g. London HQ"
                  {...form.register("workLocation")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-employment-type">Employment type</Label>
                <Select
                  value={form.watch("employmentType")}
                  onValueChange={(value) =>
                    form.setValue("employmentType", value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="create-employment-type">
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Manager</h3>
                <p className="text-sm text-muted-foreground">
                  Optional reporting assignment for immediate org-chart placement.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-manager-search">Find manager</Label>
                <Input
                  id="create-manager-search"
                  value={managerSearch}
                  placeholder="Search by name or email"
                  onChange={(event) => setManagerSearch(event.target.value)}
                />
              </div>

              <div className="overflow-hidden rounded-lg border">
                <button
                  type="button"
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-muted/40 ${
                    selectedManagerId === "" ? "bg-muted/50" : ""
                  }`}
                  onClick={() =>
                    form.setValue("managerId", "", { shouldDirty: true })
                  }
                >
                  <div className="space-y-1">
                    <p className="font-medium">No manager assigned</p>
                    <p className="text-xs text-muted-foreground">
                      Leave the employee unassigned in the reporting hierarchy.
                    </p>
                  </div>
                  {selectedManagerId === "" ? (
                    <span className="text-xs font-medium text-foreground">
                      Selected
                    </span>
                  ) : null}
                </button>

                <div className="border-t">
                  {deferredManagerSearch.trim().length < 2 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      Type at least 2 characters to search active managers.
                    </div>
                  ) : managerOptionsQuery.isLoading ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                      <Spinner className="h-4 w-4" />
                      Loading matching employees...
                    </div>
                  ) : managerOptionsQuery.error ? (
                    <div className="px-4 py-3 text-sm text-destructive">
                      {managerOptionsQuery.error.message ||
                        "Unable to load manager options right now."}
                    </div>
                  ) : managerOptions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No employees matched this search.
                    </div>
                  ) : (
                    <div className="max-h-60 divide-y overflow-y-auto">
                      {managerOptions.map((option) => {
                        const isSelected = selectedManagerId === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-muted/40 ${
                              isSelected ? "bg-muted/50" : ""
                            }`}
                            onClick={() =>
                              form.setValue("managerId", option.id, {
                                shouldDirty: true,
                              })
                            }
                          >
                            <div className="space-y-1">
                              <p className="font-medium">
                                {getEmployeeDisplayName(option)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {option.email}
                                {option.jobTitle ? ` · ${option.jobTitle}` : ""}
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

              {selectedManager ? (
                <p className="text-xs text-muted-foreground">
                  Selected manager: {getEmployeeDisplayName(selectedManager)}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Org unit</h3>
                <p className="text-sm text-muted-foreground">
                  Optional org-unit assignment used in roster filters and org chart views.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-org-unit-search">Find org unit</Label>
                <Input
                  id="create-org-unit-search"
                  value={orgUnitSearch}
                  placeholder="Search by unit name or code"
                  onChange={(event) => setOrgUnitSearch(event.target.value)}
                />
              </div>

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
                      Create the employee without an initial org-unit assignment.
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
                    <div className="max-h-60 divide-y overflow-y-auto">
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
                                {option.parentName
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

              {selectedOrgUnit ? (
                <p className="text-xs text-muted-foreground">
                  Selected org unit: {getOrgUnitDisplayLabel(selectedOrgUnit)}
                </p>
              ) : null}
            </div>
          </div>

          {submitError ? (
            <Alert variant="destructive">
              <AlertTitle>Employee creation failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createEmployee.isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createEmployee.isLoading}>
              {createEmployee.isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Creating
                </>
              ) : (
                "Create employee"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
