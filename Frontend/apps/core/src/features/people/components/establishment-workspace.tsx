"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  cn,
} from "@repo/ds";
import { PageContainer, StatusBadge } from "@repo/ds/shell";
import type {
  AddExistingEmployeeRequest,
  EstablishmentReviewDto,
  HireEmployeeRequest,
  ManagerOptionDto,
  OrganizationHierarchyNodeDto,
} from "@repo/api";
import { ApiError } from "@repo/api";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useOrganizationHierarchy } from "@/features/organization/api/use-organization";
import { OrganizationTree } from "@/features/organization/components/organization-tree";
import { useManagerOptions, usePeopleEstablishmentMutations } from "../api/use-people";
import { EmployeeIdentity, Monogram, OrgPath, formatWorkforceDate, initials } from "./workforce-ui";

type EstablishmentMode = "hire" | "add-existing";
type FormState = {
  firstName: string;
  lastName: string;
  preferredName: string;
  workEmail: string;
  phone: string;
  numberMode: "Generated" | "Manual";
  employeeNumber: string;
  startDate: string;
  workDate: string;
  orgUnitId: string;
  jobTitle: string;
  location: string;
  managerMode: "None" | "Manager";
  managerEmployeeId: string;
};

type Errors = Partial<Record<keyof FormState | "form", string>>;

const today = () => new Date().toISOString().slice(0, 10);

type OrgChoice = { id: string; name: string; path: string; depth: number };
function flattenOrg(nodes: OrganizationHierarchyNodeDto[], depth = 0): OrgChoice[] {
  return nodes.flatMap((node) => [
    { id: node.unit.id, name: node.unit.name, path: node.unit.path, depth },
    ...flattenOrg(node.children, depth + 1),
  ]);
}

/** Compact two-option segmented control — a mode choice, not two large cards. */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="cursor-pointer rounded-lg px-3.5 py-1.5 type-label text-muted-foreground transition-colors has-data-[state=checked]:bg-background has-data-[state=checked]:text-foreground has-data-[state=checked]:shadow-sm focus-within:ring-2 focus-within:ring-ring motion-reduce:transition-none"
        >
          <RadioGroupItem value={option.value} className="sr-only" />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  );
}

function OrganizationPicker({
  roots,
  value,
  onChange,
  invalid,
}: {
  roots: OrganizationHierarchyNodeDto[];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => flattenOrg(roots).find((choice) => choice.id === value), [roots, value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-invalid={invalid} className={cn("h-auto min-h-11 w-full justify-between py-2 font-normal", selected && "border-foreground/25")}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            {selected ? (
              <OrgPath name={selected.name} path={selected.path} className="text-left" showAncestry={false} />
            ) : (
              <span className="text-muted-foreground">Select organization</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-0">
        <OrganizationTree
          roots={roots}
          selectedId={value || null}
          onSelect={(id) => {
            if (id) {
              onChange(id);
              setOpen(false);
            }
          }}
          emptyLabel="No valid unit on this date"
        />
      </PopoverContent>
    </Popover>
  );
}

function ManagerPicker({
  options,
  value,
  onChange,
  loading,
  invalid,
}: {
  options: ManagerOptionDto[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  invalid: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.employeeId === value);
  const visible = options.filter((option) =>
    !query.trim() || `${option.displayName} ${option.employeeNumber} ${option.organizationPath}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-invalid={invalid} className={cn("h-auto min-h-11 w-full justify-between py-2 font-normal", selected && "border-foreground/25")}>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Monogram name={selected.displayName} size="sm" />
              <span className="min-w-0 text-left">
                <span className="block truncate type-label">{selected.displayName}</span>
                <span className="block truncate type-meta text-muted-foreground">{selected.jobTitle}</span>
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Search for a manager</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(34rem,calc(100vw-2rem))] p-0">
        <div className="relative border-b p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Employee Number, or email" aria-label="Search managers" className="pl-9" />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <div className="space-y-2 p-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : visible.map((option) => (
            <button
              type="button"
              key={option.employeeId}
              onClick={() => onChange(option.employeeId)}
              aria-pressed={value === option.employeeId}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted"
            >
              <EmployeeIdentity
                name={option.displayName}
                employeeNumber={option.employeeNumber}
                secondary={`${option.jobTitle} · ${option.organizationName}`}
              />
              <span className="flex shrink-0 items-center gap-2">
                {option.availability === "Scheduled" ? <StatusBadge tone="info">Starts later</StatusBadge> : null}
                {value === option.employeeId ? <Check className="size-4" /> : null}
              </span>
            </button>
          ))}
          {!loading && visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {options.length === 0 ? "No manager is available on this date" : "No manager matches your search"}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-8 first:border-t-0 first:pt-0">
      <h2 className="type-eyebrow text-muted-foreground">{title}</h2>
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.errors[0] ?? "The employee could not be added.";
  return error instanceof Error ? error.message : "The employee could not be added.";
}

export default function EstablishmentWorkspace({ mode }: { mode: EstablishmentMode }) {
  const router = useRouter();
  const isHire = mode === "hire";
  const [form, setForm] = useState<FormState>({
    firstName: "", lastName: "", preferredName: "", workEmail: "", phone: "",
    numberMode: "Generated", employeeNumber: "", startDate: isHire ? today() : "",
    workDate: today(), orgUnitId: "", jobTitle: "", location: "",
    managerMode: "None", managerEmployeeId: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<EstablishmentReviewDto | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const manualNumberRef = useRef<HTMLInputElement>(null);
  const effectiveDate = isHire ? form.startDate : form.workDate;
  const hierarchy = useOrganizationHierarchy(effectiveDate || today(), Boolean(effectiveDate));
  const orgChoices = useMemo(() => flattenOrg(hierarchy.data?.roots ?? []), [hierarchy.data?.roots]);
  const managers = useManagerOptions(effectiveDate || today(), "");
  const mutations = usePeopleEstablishmentMutations();
  const mutation = isHire ? mutations.hire : mutations.addExisting;
  const selectedOrg = orgChoices.find((choice) => choice.id === form.orgUnitId);
  const selectedManager = managers.data?.find((option) => option.employeeId === form.managerEmployeeId);

  const displayName = `${form.preferredName.trim() || form.firstName.trim()} ${form.lastName.trim()}`.trim();
  const isFutureStart = isHire && Boolean(form.startDate) && form.startDate > today();
  const resultingState = isHire ? (isFutureStart ? "Scheduled" : "Active") : "Active";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "startDate" || key === "workDate") {
        next.orgUnitId = "";
        next.managerEmployeeId = "";
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    setReviewing(false);
    setReviewResult(null);
  };

  const validate = () => {
    const next: Errors = {};
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (form.workEmail && !/^\S+@\S+\.\S+$/.test(form.workEmail)) next.workEmail = "Enter a valid work email.";
    if (form.numberMode === "Manual" && !form.employeeNumber.trim()) next.employeeNumber = "Enter an Employee Number.";
    if (!form.startDate) next.startDate = isHire ? "Start date is required." : "Employment start is required.";
    if (!isHire && !form.workDate) next.workDate = "Work details effective date is required.";
    if (!isHire && form.startDate && form.workDate && form.workDate < form.startDate) next.workDate = "Work details cannot begin before employment.";
    if (!isHire && form.startDate > today()) next.startDate = "A future start belongs in Hire employee.";
    if (!form.orgUnitId) next.orgUnitId = "Select an organization.";
    if (!form.jobTitle.trim()) next.jobTitle = "Display title is required.";
    if (form.managerMode === "Manager" && !form.managerEmployeeId) next.managerEmployeeId = "Select a manager or choose No manager.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const review = async () => {
    if (!validate()) {
      setErrors((current) => ({ ...current, form: "Review the highlighted fields." }));
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    try {
      const result = await mutations.review.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        workEmail: form.workEmail.trim() || null,
        employeeNumberMode: form.numberMode,
        employeeNumber: form.numberMode === "Manual" ? form.employeeNumber.trim() : null,
      });
      setReviewResult(result);
      setReviewing(true);
      window.requestAnimationFrame(() => reviewRef.current?.focus());
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    }
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      const common = {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(), preferredName: form.preferredName.trim() || null,
        workEmail: form.workEmail.trim() || null, phone: form.phone.trim() || null,
        employeeNumberMode: form.numberMode, employeeNumber: form.numberMode === "Manual" ? form.employeeNumber.trim() : null,
        orgUnitId: form.orgUnitId, jobTitle: form.jobTitle.trim(),
        location: form.location.trim() || null, primaryManagerEmployeeId: form.managerMode === "Manager" ? form.managerEmployeeId : null,
      };
      const result = isHire
        ? await mutations.hire.mutateAsync({ ...common, startDate: form.startDate } satisfies HireEmployeeRequest)
        : await mutations.addExisting.mutateAsync({ ...common, employmentStart: form.startDate, workDetailsEffectiveFrom: form.workDate } satisfies AddExistingEmployeeRequest);
      router.push(`/people/${result.employeeKey}?established=${mode}`);
    } catch (error) {
      setErrors({ form: errorMessage(error) });
      reviewRef.current?.focus();
    }
  };

  const numberSummary = form.numberMode === "Manual"
    ? (form.employeeNumber.trim().toUpperCase() || "Enter manually")
    : "Assigned automatically";

  const summary = (
    <dl className="space-y-4">
      <div>
        <dt className="type-eyebrow text-muted-foreground">Employee</dt>
        <dd className="mt-1.5">
          {displayName ? (
            <div className="flex items-center gap-3">
              <Monogram name={displayName} size="md" accent={resultingState === "Scheduled"} />
              <div className="min-w-0">
                <p className="type-label font-semibold">{displayName}</p>
                <p className="type-code text-xs text-muted-foreground">{numberSummary}</p>
              </div>
            </div>
          ) : <p className="type-body text-muted-foreground">Add a name to begin</p>}
        </dd>
      </div>
      <div className="border-t pt-4">
        <dt className="type-eyebrow text-muted-foreground">Employment</dt>
        <dd className="mt-1.5 space-y-1">
          {isHire ? (
            <div className="flex items-center gap-2">
              <StatusBadge tone={resultingState === "Scheduled" ? "info" : "success"} dot>{resultingState}</StatusBadge>
              {form.startDate ? <span className="type-meta text-muted-foreground">Starts {formatWorkforceDate(form.startDate)}</span> : null}
            </div>
          ) : (
            <>
              <p className="type-body">Employment start · {form.startDate ? formatWorkforceDate(form.startDate) : "—"}</p>
              <p className="type-meta text-muted-foreground">Work details effective · {form.workDate ? formatWorkforceDate(form.workDate) : "—"}</p>
            </>
          )}
        </dd>
      </div>
      <div className="border-t pt-4">
        <dt className="type-eyebrow text-muted-foreground">Work</dt>
        <dd className="mt-1.5 space-y-1">
          <p className="type-body font-medium">{form.jobTitle.trim() || <span className="font-normal text-muted-foreground">Display title</span>}</p>
          {selectedOrg ? <OrgPath name={selectedOrg.name} path={selectedOrg.path} /> : <p className="type-meta text-muted-foreground">Organization not set</p>}
          {form.location.trim() ? <p className="type-meta text-muted-foreground">{form.location.trim()}</p> : null}
        </dd>
      </div>
      <div className="border-t pt-4">
        <dt className="type-eyebrow text-muted-foreground">Reporting</dt>
        <dd className="mt-1.5">
          {form.managerMode === "None" ? (
            <p className="type-body">No manager</p>
          ) : selectedManager ? (
            <EmployeeIdentity name={selectedManager.displayName} employeeNumber={selectedManager.employeeNumber} secondary={selectedManager.jobTitle} size="sm" />
          ) : <p className="type-body text-muted-foreground">Manager not selected</p>}
        </dd>
      </div>
    </dl>
  );

  return (
    <PageContainer width="wide" className="pb-16">
      <Link href="/people" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" />People
      </Link>
      <header className="mb-8 max-w-3xl">
        <p className="type-eyebrow text-muted-foreground">{isHire ? "New hire" : "Existing employee"}</p>
        <h1 className="mt-1.5 type-page-title">{isHire ? "Hire employee" : "Add existing employee"}</h1>
      </header>

      <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,34rem)_1fr]">
        {/* Left column: editing form or focused review */}
        <div className="min-w-0">
          {errors.form && !reviewing ? <div role="alert" className="mb-6 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">{errors.form}</div> : null}

          <form
            onSubmit={(event) => { event.preventDefault(); void review(); }}
            noValidate
            hidden={reviewing}
            className="space-y-8"
          >
            <FormSection title="Employee">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.firstName)}><FieldLabel htmlFor="firstName">First name</FieldLabel><Input id="firstName" value={form.firstName} onChange={(event) => set("firstName", event.target.value)} aria-invalid={Boolean(errors.firstName)} autoComplete="given-name" /><FieldError>{errors.firstName}</FieldError></Field>
                <Field data-invalid={Boolean(errors.lastName)}><FieldLabel htmlFor="lastName">Last name</FieldLabel><Input id="lastName" value={form.lastName} onChange={(event) => set("lastName", event.target.value)} aria-invalid={Boolean(errors.lastName)} autoComplete="family-name" /><FieldError>{errors.lastName}</FieldError></Field>
                <Field><FieldLabel htmlFor="preferredName">Preferred name <span className="font-normal text-muted-foreground">Optional</span></FieldLabel><Input id="preferredName" value={form.preferredName} onChange={(event) => set("preferredName", event.target.value)} /></Field>
                <Field data-invalid={Boolean(errors.workEmail)}><FieldLabel htmlFor="workEmail">Work email <span className="font-normal text-muted-foreground">Optional</span></FieldLabel><Input id="workEmail" type="email" value={form.workEmail} onChange={(event) => set("workEmail", event.target.value)} aria-invalid={Boolean(errors.workEmail)} autoComplete="email" /><FieldError>{errors.workEmail}</FieldError></Field>
              </div>

              <Field data-invalid={Boolean(errors.employeeNumber)}>
                <FieldLabel>Employee Number</FieldLabel>
                <Segmented
                  label="Employee Number mode"
                  value={form.numberMode}
                  onValueChange={(value) => {
                    set("numberMode", value);
                    if (value === "Manual") window.requestAnimationFrame(() => manualNumberRef.current?.focus());
                  }}
                  options={[{ value: "Generated", label: "Generate automatically" }, { value: "Manual", label: "Enter manually" }]}
                />
                {form.numberMode === "Manual" ? (
                  <Input
                    ref={manualNumberRef}
                    value={form.employeeNumber}
                    onChange={(event) => set("employeeNumber", event.target.value)}
                    aria-label="Employee Number"
                    aria-invalid={Boolean(errors.employeeNumber)}
                    placeholder="e.g. EMP-00042"
                    className="mt-3 font-mono uppercase sm:max-w-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
                  />
                ) : null}
                <FieldError>{errors.employeeNumber}</FieldError>
              </Field>

              <Collapsible>
                <CollapsibleTrigger className="group inline-flex items-center gap-1.5 type-meta text-muted-foreground underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
                  Additional details
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <Field><FieldLabel htmlFor="phone">Phone <span className="font-normal text-muted-foreground">Optional</span></FieldLabel><Input id="phone" value={form.phone} onChange={(event) => set("phone", event.target.value)} autoComplete="tel" className="sm:max-w-xs" /></Field>
                </CollapsibleContent>
              </Collapsible>
            </FormSection>

            <FormSection title="Employment">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.startDate)}>
                  <FieldLabel htmlFor="startDate">{isHire ? "Start date" : "Employment start"}</FieldLabel>
                  <Input id="startDate" type="date" min={isHire ? today() : undefined} max={!isHire ? today() : undefined} value={form.startDate} onChange={(event) => set("startDate", event.target.value)} aria-invalid={Boolean(errors.startDate)} className="w-full" />
                  <FieldError>{errors.startDate}</FieldError>
                </Field>
                {!isHire ? (
                  <Field data-invalid={Boolean(errors.workDate)}>
                    <FieldLabel htmlFor="workDate">Work details effective from</FieldLabel>
                    <Input id="workDate" type="date" min={form.startDate || undefined} max={today()} value={form.workDate} onChange={(event) => set("workDate", event.target.value)} aria-invalid={Boolean(errors.workDate)} className="w-full" />
                    <FieldError>{errors.workDate}</FieldError>
                  </Field>
                ) : isFutureStart ? (
                  <div className="flex items-end pb-2"><StatusBadge tone="info" dot>Scheduled · starts {formatWorkforceDate(form.startDate)}</StatusBadge></div>
                ) : null}
              </div>
            </FormSection>

            <FormSection title={isHire ? "Work" : "Current work"}>
              <Field data-invalid={Boolean(errors.orgUnitId)}><FieldLabel>Organization</FieldLabel><OrganizationPicker roots={hierarchy.data?.roots ?? []} value={form.orgUnitId} onChange={(value) => set("orgUnitId", value)} invalid={Boolean(errors.orgUnitId)} /><FieldError>{errors.orgUnitId}</FieldError></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.jobTitle)}><FieldLabel htmlFor="jobTitle">Display title</FieldLabel><Input id="jobTitle" value={form.jobTitle} onChange={(event) => set("jobTitle", event.target.value)} aria-invalid={Boolean(errors.jobTitle)} placeholder="e.g. Senior Consultant" /><FieldError>{errors.jobTitle}</FieldError></Field>
                <Field><FieldLabel htmlFor="location">Location <span className="font-normal text-muted-foreground">Optional</span></FieldLabel><Input id="location" value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="e.g. Tunis" /></Field>
              </div>
            </FormSection>

            <FormSection title="Reporting">
              <Segmented
                label="Reporting"
                value={form.managerMode}
                onValueChange={(value) => set("managerMode", value)}
                options={[{ value: "None", label: "No manager" }, { value: "Manager", label: "Assign a manager" }]}
              />
              {form.managerMode === "Manager" ? (
                <Field data-invalid={Boolean(errors.managerEmployeeId)} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
                  <FieldLabel>Manager</FieldLabel>
                  <ManagerPicker options={managers.data ?? []} value={form.managerEmployeeId} onChange={(value) => set("managerEmployeeId", value)} loading={managers.isLoading} invalid={Boolean(errors.managerEmployeeId)} />
                  <FieldError>{errors.managerEmployeeId}</FieldError>
                </Field>
              ) : null}
            </FormSection>

            <div className="flex items-center justify-end border-t pt-6">
              <Button type="submit" disabled={mutations.review.isLoading}>
                {mutations.review.isLoading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : null}
                {isHire ? "Review hire" : "Review employee"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>

          {reviewing ? (
            <div ref={reviewRef} tabIndex={-1} aria-labelledby="review-heading" className="outline-none motion-safe:animate-in motion-safe:fade-in">
              <div className="flex items-center justify-between gap-4">
                <h2 id="review-heading" className="type-section-title">Review {isHire ? "hire" : "employee"}</h2>
                <Button type="button" variant="ghost" size="sm" disabled={mutation.isLoading} onClick={() => setReviewing(false)}>
                  <Pencil className="size-3.5" /> Edit details
                </Button>
              </div>

              {reviewResult?.conflict ? (
                <div role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/8 p-4 text-sm">
                  <p className="font-semibold text-destructive">This person already exists</p>
                  <p className="mt-1 text-muted-foreground">{reviewResult.conflict.message}</p>
                  <Link className="mt-3 inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 font-medium underline-offset-4 hover:bg-muted" href={`/people/${reviewResult.conflict.employeeKey}`}>
                    <Monogram name={reviewResult.conflict.displayName} size="sm" /> {reviewResult.conflict.displayName} · {reviewResult.conflict.employeeNumber}
                  </Link>
                </div>
              ) : null}

              <div className="mt-5 rounded-2xl border bg-card p-5">{summary}</div>

              {reviewResult?.suggestions.length ? (
                <div className="mt-5 rounded-xl border border-warning/30 bg-warning-subtle/50 p-4">
                  <p className="type-label font-semibold">This may already be someone in Fusion</p>
                  <ul className="mt-3 space-y-2.5">
                    {reviewResult.suggestions.map((suggestion) => (
                      <li key={suggestion.employeeKey} className="flex items-center justify-between gap-3">
                        <EmployeeIdentity name={suggestion.displayName} employeeNumber={suggestion.employeeNumber} secondary={suggestion.reason} href={`/people/${suggestion.employeeKey}`} size="sm" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {errors.form ? <p role="alert" className="mt-5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p> : null}

              {!reviewResult?.conflict ? (
                <div className="mt-6 flex items-center gap-3 border-t pt-6">
                  <Button type="button" disabled={mutation.isLoading} onClick={() => void submit()}>
                    {mutation.isLoading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Check className="size-4" />}
                    {isHire ? "Hire employee" : "Add employee"}
                  </Button>
                  <Button type="button" variant="ghost" disabled={mutation.isLoading} onClick={() => setReviewing(false)}>Edit details</Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right column: live resulting-state summary (desktop) */}
        <aside className="top-6 hidden xl:sticky xl:block" aria-label="Resulting employee">
          <div className="rounded-2xl border bg-muted/25 p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-background text-muted-foreground">
                {displayName ? <span className="type-code text-xs font-semibold">{initials(displayName)}</span> : <Plus className="size-4" />}
              </span>
              <p className="type-eyebrow text-muted-foreground">{reviewing ? "Ready to add" : "Resulting employee"}</p>
            </div>
            <div className="mt-5">{summary}</div>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
