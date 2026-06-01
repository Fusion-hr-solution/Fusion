"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@repo/api";
import { ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useEmployeeFieldPolicy } from "@/features/employees/shared/employee-field-visibility";
import { cn } from "@/lib/utils";
import type {
  EmployeeOrgUnitOption,
  EmployeeRosterItem,
} from "./employee-roster.types";
import {
  useCreateEmployeeRecord,
  useEmployeeManagerOptions,
  useEmployeeOrgUnitOptions,
} from "./use-employees";

interface CreateEmployeeFormValues {
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  jobTitle: string;
  managerId: string;
  orgUnitId: string;
}

interface EmployeeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (employeeId: string) => void;
}

type ServerFieldName = "email" | "managerId" | "orgUnitId";

interface CreateEmployeeErrorState {
  field?: ServerFieldName;
  message: string;
}

interface SearchPickerFieldProps<TOption extends { id: string }> {
  id: string;
  label: string;
  supportingLabel?: string;
  value: string;
  open: boolean;
  search: string;
  placeholder: string;
  searchPlaceholder: string;
  clearOptionLabel: string;
  clearOptionDescription: string;
  emptyState: ReactNode;
  options: TOption[];
  selectedOption: TOption | null;
  isLoading: boolean;
  errorMessage: string | null;
  fieldError?: string;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelectOption: (option: TOption | null) => void;
  getPrimaryText: (option: TOption) => string;
  getSecondaryText?: (option: TOption) => string | null;
}

const DEFAULT_CREATE_VALUES: CreateEmployeeFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  hireDate: "",
  jobTitle: "",
  managerId: "",
  orgUnitId: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toApiHireDate(value: string) {
  return `${value}T00:00:00.000Z`;
}

function isServerFieldName(name: string): name is ServerFieldName {
  return name === "email" || name === "managerId" || name === "orgUnitId";
}

function getQueryErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function getCreateEmployeeErrorState(error: unknown): CreateEmployeeErrorState {
  if (error instanceof ApiError) {
    const message = error.errors[0] ?? error.message;

    if (error.status === 403) {
      return { message: "You do not have permission to add employees." };
    }

    if (error.status === 409 && /email/i.test(message)) {
      return {
        field: "email",
        message: "An employee with this email already exists.",
      };
    }

    if (/org unit/i.test(message)) {
      return {
        field: "orgUnitId",
        message: "Select a valid organization unit.",
      };
    }

    if (/manager/i.test(message)) {
      return {
        field: "managerId",
        message: "Select a valid manager.",
      };
    }

    return { message };
  }

  return {
    message:
      error instanceof Error
        ? error.message
        : "An unexpected error occurred. Please try again.",
  };
}

function getEmployeeDisplayName(employee: EmployeeRosterItem) {
  return `${employee.firstName} ${employee.lastName}`;
}

function getEmployeeSecondaryText(employee: EmployeeRosterItem) {
  const details = [employee.email, employee.jobTitle].filter(Boolean);

  return details.length > 0 ? details.join(" · ") : null;
}

function getOrgUnitDisplayLabel(option: EmployeeOrgUnitOption) {
  return `${option.name} · ${option.code}`;
}

function getOrgUnitSecondaryText(option: EmployeeOrgUnitOption) {
  return option.parentName
    ? `${option.type} · ${option.parentName}`
    : `${option.type} · Root unit`;
}

function FieldErrorMessage({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

function SearchPickerField<TOption extends { id: string }>({
  id,
  label,
  supportingLabel,
  value,
  open,
  search,
  placeholder,
  searchPlaceholder,
  clearOptionLabel,
  clearOptionDescription,
  emptyState,
  options,
  selectedOption,
  isLoading,
  errorMessage,
  fieldError,
  onOpenChange,
  onSearchChange,
  onSelectOption,
  getPrimaryText,
  getSecondaryText,
}: SearchPickerFieldProps<TOption>) {
  const errorId = `${id}-error`;
  const selectedSecondaryText = selectedOption
    ? (getSecondaryText?.(selectedOption) ?? null)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        {supportingLabel ? (
          <span className="text-xs text-muted-foreground">
            {supportingLabel}
          </span>
        ) : null}
      </div>

      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            className={cn(
              "h-auto min-h-12 w-full justify-between rounded-xl px-3 py-2 text-left font-normal shadow-none",
              !selectedOption && "text-muted-foreground",
              fieldError && "border-destructive"
            )}
          >
            <span className="min-w-0 flex-1">
              {selectedOption ? (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">
                    {getPrimaryText(selectedOption)}
                  </span>
                  {selectedSecondaryText ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {selectedSecondaryText}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="truncate text-sm text-muted-foreground">
                  {placeholder}
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-3 size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
            <CommandList className="max-h-64">
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Loading...
                </div>
              ) : errorMessage ? (
                <div className="px-3 py-6 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : (
                <>
                  <CommandGroup>
                    <CommandItem
                      value={clearOptionLabel}
                      data-checked={!value ? true : undefined}
                      className="items-start py-3"
                      onSelect={() => {
                        onSelectOption(null);
                        onOpenChange(false);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="truncate font-medium">
                          {clearOptionLabel}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {clearOptionDescription}
                        </span>
                      </div>
                    </CommandItem>
                  </CommandGroup>

                  <CommandSeparator />

                  {options.length > 0 ? (
                    <CommandGroup>
                      {options.map((option) => {
                        const primaryText = getPrimaryText(option);
                        const secondaryText =
                          getSecondaryText?.(option) ?? null;
                        const isSelected = value === option.id;

                        return (
                          <CommandItem
                            key={option.id}
                            value={`${primaryText} ${secondaryText ?? ""}`}
                            data-checked={isSelected ? true : undefined}
                            className="items-start py-3"
                            onSelect={() => {
                              onSelectOption(option);
                              onOpenChange(false);
                            }}
                          >
                            <div className="flex min-w-0 flex-1 flex-col text-left">
                              <span className="truncate font-medium">
                                {primaryText}
                              </span>
                              {secondaryText ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {secondaryText}
                                </span>
                              ) : null}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : (
                    <div className="px-3 py-6 text-sm text-muted-foreground">
                      {emptyState}
                    </div>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <FieldErrorMessage id={errorId} message={fieldError} />
    </div>
  );
}

export function EmployeeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: EmployeeCreateDialogProps) {
  const createEmployee = useCreateEmployeeRecord();
  const fieldPolicy = useEmployeeFieldPolicy(open);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [managerSearch, setManagerSearch] = useState("");
  const [orgUnitSearch, setOrgUnitSearch] = useState("");
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [orgUnitPickerOpen, setOrgUnitPickerOpen] = useState(false);
  const [selectedManagerSnapshot, setSelectedManagerSnapshot] =
    useState<EmployeeRosterItem | null>(null);
  const [selectedOrgUnitSnapshot, setSelectedOrgUnitSnapshot] =
    useState<EmployeeOrgUnitOption | null>(null);
  const deferredManagerSearch = useDeferredValue(managerSearch);
  const deferredOrgUnitSearch = useDeferredValue(orgUnitSearch);
  const form = useForm<CreateEmployeeFormValues>({
    defaultValues: DEFAULT_CREATE_VALUES,
    reValidateMode: "onChange",
  });
  const managerOptionsQuery = useEmployeeManagerOptions({
    employeeId: null,
    search: deferredManagerSearch,
    enabled: open,
  });
  const orgUnitOptionsQuery = useEmployeeOrgUnitOptions({
    search: deferredOrgUnitSearch,
    enabled: open,
  });
  const isSubmitting = createEmployee.isLoading;

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(DEFAULT_CREATE_VALUES);
    setSubmitError(null);
    setManagerSearch("");
    setOrgUnitSearch("");
    setManagerPickerOpen(false);
    setOrgUnitPickerOpen(false);
    setSelectedManagerSnapshot(null);
    setSelectedOrgUnitSnapshot(null);

    const focusFrame = window.requestAnimationFrame(() => {
      form.setFocus("firstName");
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [form, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const subscription = form.watch((_values, info) => {
      if (!info.name) {
        return;
      }

      if (submitError) {
        setSubmitError(null);
      }

      if (isServerFieldName(info.name)) {
        form.clearErrors(info.name);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, open, submitError]);

  const managerOptions = managerOptionsQuery.data?.items ?? [];
  const orgUnits = orgUnitOptionsQuery.data?.items ?? [];
  const selectedManagerId = form.watch("managerId");
  const selectedOrgUnitId = form.watch("orgUnitId");
  const selectedManager = useMemo(
    () =>
      managerOptions.find((option) => option.id === selectedManagerId) ??
      selectedManagerSnapshot,
    [managerOptions, selectedManagerId, selectedManagerSnapshot]
  );
  const selectedOrgUnit = useMemo(
    () =>
      orgUnits.find((option) => option.id === selectedOrgUnitId) ??
      selectedOrgUnitSnapshot,
    [orgUnits, selectedOrgUnitId, selectedOrgUnitSnapshot]
  );

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) {
      return;
    }

    onOpenChange(nextOpen);
  }

  function handleManagerPickerOpenChange(nextOpen: boolean) {
    setManagerPickerOpen(nextOpen);

    if (!nextOpen) {
      setManagerSearch("");
    }
  }

  function handleOrgUnitPickerOpenChange(nextOpen: boolean) {
    setOrgUnitPickerOpen(nextOpen);

    if (!nextOpen) {
      setOrgUnitSearch("");
    }
  }

  function handleManagerSelect(option: EmployeeRosterItem | null) {
    form.setValue("managerId", option?.id ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedManagerSnapshot(option);
  }

  function handleOrgUnitSelect(option: EmployeeOrgUnitOption | null) {
    form.setValue("orgUnitId", option?.id ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedOrgUnitSnapshot(option);
  }

  async function handleSubmit(values: CreateEmployeeFormValues) {
    setSubmitError(null);
    form.clearErrors(["email", "managerId", "orgUnitId"]);

    try {
      const created = await createEmployee.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        hireDate: toApiHireDate(values.hireDate),
        jobTitle: fieldPolicy.showJobTitle
          ? values.jobTitle.trim() || null
          : undefined,
        managerId: values.managerId || undefined,
        orgUnitId: values.orgUnitId || undefined,
      });

      handleDialogOpenChange(false);
      toast.success("Employee added", {
        action: {
          label: "Open profile",
          onClick: () => onCreated(created.id),
        },
        cancel: {
          label: "Add another",
          onClick: () => onOpenChange(true),
        },
      });
    } catch (error) {
      const nextError = getCreateEmployeeErrorState(error);

      if (nextError.field) {
        form.setError(nextError.field, {
          type: "server",
          message: nextError.message,
        });
        return;
      }

      setSubmitError(nextError.message);
    }
  }

  const firstNameError = form.formState.errors.firstName?.message;
  const lastNameError = form.formState.errors.lastName?.message;
  const emailError = form.formState.errors.email?.message;
  const hireDateError = form.formState.errors.hireDate?.message;
  const jobTitleError = form.formState.errors.jobTitle?.message;
  const managerError = form.formState.errors.managerId?.message;
  const orgUnitError = form.formState.errors.orgUnitId?.message;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={!isSubmitting}
        className="overflow-hidden p-0 sm:max-w-[720px]"
      >
        <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-left">
          <DialogTitle className="text-xl font-semibold">
            Add employee
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new employee record.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex max-h-[85vh] flex-col"
          onSubmit={form.handleSubmit((values) => void handleSubmit(values))}
        >
          <div className="flex-1 overflow-y-auto bg-muted/10">
            <div className="space-y-5 px-6 py-5 pt-2">
              <section className="space-y-4 rounded-xl border bg-background p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Employee details
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="create-first-name">First name</Label>
                    <Input
                      id="create-first-name"
                      autoComplete="given-name"
                      aria-invalid={firstNameError ? true : undefined}
                      aria-describedby={
                        firstNameError ? "create-first-name-error" : undefined
                      }
                      {...form.register("firstName", {
                        validate: (value) =>
                          value.trim().length > 0 || "First name is required.",
                      })}
                    />
                    <FieldErrorMessage
                      id="create-first-name-error"
                      message={firstNameError}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-last-name">Last name</Label>
                    <Input
                      id="create-last-name"
                      autoComplete="family-name"
                      aria-invalid={lastNameError ? true : undefined}
                      aria-describedby={
                        lastNameError ? "create-last-name-error" : undefined
                      }
                      {...form.register("lastName", {
                        validate: (value) =>
                          value.trim().length > 0 || "Last name is required.",
                      })}
                    />
                    <FieldErrorMessage
                      id="create-last-name-error"
                      message={lastNameError}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-email">Work email</Label>
                    <Input
                      id="create-email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      inputMode="email"
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={
                        emailError ? "create-email-error" : undefined
                      }
                      {...form.register("email", {
                        validate: (value) => {
                          const trimmedValue = value.trim();

                          if (trimmedValue.length === 0) {
                            return "Work email is required.";
                          }

                          return EMAIL_PATTERN.test(trimmedValue)
                            ? true
                            : "Enter a valid work email.";
                        },
                      })}
                    />
                    <FieldErrorMessage
                      id="create-email-error"
                      message={emailError}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-hire-date">Hire date</Label>
                    <Input
                      id="create-hire-date"
                      type="date"
                      aria-invalid={hireDateError ? true : undefined}
                      aria-describedby={
                        hireDateError ? "create-hire-date-error" : undefined
                      }
                      {...form.register("hireDate", {
                        validate: (value) =>
                          !fieldPolicy.requireHireDate || value.length > 0
                            ? true
                            : "Hire date is required.",
                      })}
                    />
                    <FieldErrorMessage
                      id="create-hire-date-error"
                      message={hireDateError}
                    />
                  </div>

                  {fieldPolicy.showJobTitle ? (
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="create-job-title">Job title</Label>
                        {!fieldPolicy.requireJobTitle ? (
                          <span className="text-xs text-muted-foreground">
                            Optional
                          </span>
                        ) : null}
                      </div>
                      <Input
                        id="create-job-title"
                        placeholder="e.g. Senior HR Manager"
                        aria-invalid={jobTitleError ? true : undefined}
                        aria-describedby={
                          jobTitleError ? "create-job-title-error" : undefined
                        }
                        {...form.register("jobTitle", {
                          validate: (value) =>
                            !fieldPolicy.requireJobTitle ||
                            value.trim().length > 0
                              ? true
                              : "Job title is required.",
                        })}
                      />
                      <FieldErrorMessage
                        id="create-job-title-error"
                        message={jobTitleError}
                      />
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4 rounded-xl border bg-background p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Organization
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SearchPickerField
                    id="create-org-unit"
                    label="Organization unit"
                    supportingLabel="Optional"
                    value={selectedOrgUnitId}
                    open={orgUnitPickerOpen}
                    search={orgUnitSearch}
                    placeholder="Assign an organization unit"
                    searchPlaceholder="Search by unit name or code"
                    clearOptionLabel="No organization unit"
                    clearOptionDescription="Create the employee without an initial org-unit assignment."
                    emptyState={
                      orgUnitSearch.trim().length > 0 ? (
                        "No organization units found."
                      ) : (
                        <>
                          <p>No organization units available.</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Set up the organization structure before assigning
                            an org unit.
                          </p>
                        </>
                      )
                    }
                    options={orgUnits}
                    selectedOption={selectedOrgUnit}
                    isLoading={orgUnitOptionsQuery.isLoading}
                    errorMessage={
                      orgUnitOptionsQuery.error
                        ? getQueryErrorMessage(
                            orgUnitOptionsQuery.error,
                            "Unable to load organization units right now."
                          )
                        : null
                    }
                    fieldError={orgUnitError}
                    onOpenChange={handleOrgUnitPickerOpenChange}
                    onSearchChange={setOrgUnitSearch}
                    onSelectOption={handleOrgUnitSelect}
                    getPrimaryText={getOrgUnitDisplayLabel}
                    getSecondaryText={getOrgUnitSecondaryText}
                  />

                  <SearchPickerField
                    id="create-manager"
                    label="Manager"
                    supportingLabel="Optional"
                    value={selectedManagerId}
                    open={managerPickerOpen}
                    search={managerSearch}
                    placeholder="Assign a manager"
                    searchPlaceholder="Search by name or email"
                    clearOptionLabel="No manager"
                    clearOptionDescription="Leave the employee unassigned in the reporting hierarchy."
                    emptyState="No matching employees."
                    options={managerOptions}
                    selectedOption={selectedManager}
                    isLoading={managerOptionsQuery.isLoading}
                    errorMessage={
                      managerOptionsQuery.error
                        ? getQueryErrorMessage(
                            managerOptionsQuery.error,
                            "Unable to load employees right now."
                          )
                        : null
                    }
                    fieldError={managerError}
                    onOpenChange={handleManagerPickerOpenChange}
                    onSearchChange={setManagerSearch}
                    onSelectOption={handleManagerSelect}
                    getPrimaryText={getEmployeeDisplayName}
                    getSecondaryText={getEmployeeSecondaryText}
                  />
                </div>
              </section>
            </div>
          </div>

          <div className="border-t bg-background/95 px-6 py-4">
            {submitError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Unable to add employee</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Adding employee
                  </>
                ) : (
                  "Add employee"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
