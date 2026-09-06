"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  Building2,
  Globe2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ds/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ds/components/ui/popover";
import { Separator } from "@repo/ds/components/ui/separator";
import { cn } from "@repo/ds/lib/utils";
import { AsyncButton, PageContainer } from "@repo/ds/shell";
import { failureKind, failureMessage } from "../api";
import { useProvisionableModules, useProvisionTenant } from "../queries";
import {
  buildModuleOptions,
  selectedModulesFor,
  type ProvisioningModuleOption,
} from "./module-catalogue";
import { ModuleGrid } from "./module-grid";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  LOCALE_OPTIONS,
  PLATFORM_DEFAULT_LOCALE,
  labelForLocale,
  labelForTimeZone,
  resolveInitialTimeZone,
  timeZoneOffset,
  timeZoneOptions,
} from "./provisioning-options";
import { SearchableSelect } from "./searchable-select";
import {
  fieldForFailure,
  validateDraft,
  type FieldErrors,
  type ProvisioningDraft,
} from "./provisioning-form-state";

/**
 * Provisioning a tenant, as one page.
 *
 * Everything the decision needs is visible at once and editable at any point:
 * there is no wizard, no step order, and no review page, because none of these
 * choices depends on an earlier one. The summary on the right restates the
 * commitment where it is made, so nothing has to be carried across a navigation.
 *
 * Success is a destination rather than a message — the tenant's own record is
 * the authoritative result, so the page navigates straight to it.
 */
export function ProvisionTenantWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<ProvisioningDraft>({
    name: "",
    timeZone: DEFAULT_TIME_ZONE,
    locale: DEFAULT_LOCALE,
    selectedModuleKeys: [],
    administratorEmail: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  // The operator's own zone is only knowable in the browser, so it is applied
  // after mount; resolving it during render would disagree with the server's
  // markup and tear the hydrated form.
  useEffect(() => {
    setDraft((current) =>
      current.timeZone === DEFAULT_TIME_ZONE
        ? { ...current, timeZone: resolveInitialTimeZone() }
        : current
    );
  }, []);

  const catalogue = useProvisionableModules();
  const options = useMemo(
    () => buildModuleOptions(catalogue.data ?? []),
    [catalogue.data]
  );

  // Several hundred zones, and their offsets do not move while the form is
  // open, so the list is built once rather than on every keystroke.
  const zoneOptions = useMemo(
    () =>
      timeZoneOptions().map((zone) => ({
        value: zone.value,
        label: zone.label,
        detail: zone.offset,
        keywords: zone.keywords,
        group: zone.region,
      })),
    []
  );

  const localeOptions = useMemo(
    () =>
      LOCALE_OPTIONS.map((locale) => ({
        value: locale.value,
        label: locale.label,
        // The code is shown beside the readable name, and searched for too.
        detail: locale.value || undefined,
        keywords: `${locale.keywords} ${locale.value}`,
      })),
    []
  );

  const idempotencyKey = useIdempotencyKey(draft);

  const provision = useProvisionTenant((tenantId) => {
    router.push(`/tenants/${tenantId}`);
  });

  const submissionFailure = provision.error;
  const submissionField = submissionFailure
    ? fieldForFailure(submissionFailure)
    : null;

  // The zone resolved from the browser is still a default, not a choice, so it
  // must not make the form look edited. Captured once for comparison.
  const defaultTimeZone = useRef(DEFAULT_TIME_ZONE);
  useEffect(() => {
    defaultTimeZone.current = resolveInitialTimeZone();
  }, []);

  const isDirty = hasMeaningfulEdits(draft, defaultTimeZone.current);

  useUnsavedWorkGuard(isDirty && !provision.isLoading && !provision.data);

  // Returning to the directory should land on the list the operator left, not
  // on an unfiltered one, so the query travels with them.
  const returnHref = `/tenants${searchParams.get("from") ? `?${searchParams.get("from")}` : ""}`;

  function update<K extends keyof ProvisioningDraft>(
    key: K,
    value: ProvisioningDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  /**
   * Checked when the operator leaves a field, so an ordinary mistake is
   * answered as soon as they are finished with it rather than only when they
   * try to commit. Only the field they left is judged — reporting errors on
   * fields they have not reached yet would be scolding, not helping.
   */
  function validateField(field: keyof FieldErrors) {
    const found = validateDraft(draft);
    setErrors((current) => ({ ...current, [field]: found[field] }));
  }

  function toggleModule(key: string, selected: boolean) {
    setDraft((current) => ({
      ...current,
      selectedModuleKeys: selected
        ? [...current.selectedModuleKeys, key]
        : current.selectedModuleKeys.filter((entry) => entry !== key),
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    // A second submission while the first is in flight would provision twice if
    // the key were regenerated, so it is refused outright.
    if (provision.isLoading) {
      return;
    }

    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(found);
      return;
    }

    provision.mutate({
      name: draft.name.trim(),
      locale: draft.locale,
      timeZone: draft.timeZone,
      // Resolved through the catalogue, so an unavailable module has no
      // identifier to travel even if its key were somehow selected.
      modules: selectedModulesFor(options, draft.selectedModuleKeys),
      administratorEmail: draft.administratorEmail.trim(),
      idempotencyKey,
    });
  }

  const fieldErrors: FieldErrors = submissionField
    ? {
        ...errors,
        [submissionField]: failureMessage(submissionFailure) ?? undefined,
      }
    : errors;

  // The catalogue is a provisioning dependency, not decoration. Until it is
  // read, the page cannot say which modules the tenant would be entitled to, so
  // committing would mean approving a summary that may not match the result.
  const hasCatalogue = Boolean(catalogue.data);
  const isReady =
    hasCatalogue && Object.keys(validateDraft(draft)).length === 0;

  return (
    <PageContainer width="wide">
      <BackToTenants href={returnHref} isDirty={isDirty} />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Provision tenant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the tenant foundation and invite its first administrator.
        </p>
      </header>

      <form onSubmit={submit} noValidate>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-5">
            <SectionCard
              icon={Building2}
              title="Tenant and administrator"
              description="Who the tenant is, and who establishes access to it."
            >
              <div className="space-y-5">
                <Field
                  id="tenant-name"
                  label="Tenant display name"
                  required
                  error={fieldErrors.name}
                >
                  <Input
                    id="tenant-name"
                    value={draft.name}
                    placeholder="e.g. Northwind Tunisia"
                    onChange={(event) => update("name", event.target.value)}
                    autoComplete="organization"
                    aria-invalid={Boolean(fieldErrors.name)}
                    onBlur={() => validateField("name")}
                    aria-describedby={
                      fieldErrors.name ? "tenant-name-error" : undefined
                    }
                  />
                </Field>

                {/* The tenant and the person who administers it are separate
                    concepts, so the form separates them visibly rather than
                    running them together as adjacent fields. */}
                <Separator />

                <Field
                  id="administrator-email"
                  label="Initial administrator email"
                  required
                  hint="Receives the invitation to establish administrator access."
                  error={fieldErrors.administratorEmail}
                >
                  <Input
                    id="administrator-email"
                    type="email"
                    value={draft.administratorEmail}
                    placeholder="e.g. admin@northwind.tn"
                    onChange={(event) =>
                      update("administratorEmail", event.target.value)
                    }
                    autoComplete="email"
                    // Validated on blur, never while typing: an address is
                    // invalid for most of the time it is being entered, and
                    // nothing here reveals whether an account already exists.
                    onBlur={() => validateField("administratorEmail")}
                    aria-invalid={Boolean(fieldErrors.administratorEmail)}
                    aria-describedby={describedBy(
                      "administrator-email",
                      Boolean(fieldErrors.administratorEmail)
                    )}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              icon={Globe2}
              title="Regional defaults"
              description="Controls how dates, times, and language are presented for this tenant."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="tenant-time-zone"
                  label="Default time zone"
                  required
                  error={fieldErrors.timeZone}
                >
                  <SearchableSelect
                    id="tenant-time-zone"
                    options={zoneOptions}
                    value={draft.timeZone}
                    placeholder="Select a time zone"
                    searchPlaceholder="Search city, region or offset"
                    emptyMessage="No time zone matches."
                    invalid={Boolean(fieldErrors.timeZone)}
                    describedBy={
                      fieldErrors.timeZone ? "tenant-time-zone-error" : undefined
                    }
                    onChange={(value) => update("timeZone", value)}
                    onBlur={() => validateField("timeZone")}
                  />
                </Field>

                <Field
                  id="tenant-locale"
                  label="Default locale"
                  error={fieldErrors.locale}
                >
                  <SearchableSelect
                    id="tenant-locale"
                    options={localeOptions}
                    value={draft.locale}
                    placeholder="Select a locale"
                    searchPlaceholder="Search language, country or code"
                    emptyMessage="No locale matches."
                    invalid={Boolean(fieldErrors.locale)}
                    onChange={(value) => update("locale", value)}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              icon={Blocks}
              title="Module entitlements"
              description="What this tenant is entitled to use."
            >
              <ModuleGrid
                options={options}
                selectedKeys={draft.selectedModuleKeys}
                isLoading={catalogue.isLoading}
                error={catalogue.error}
                onRetry={catalogue.refetch}
                onToggle={toggleModule}
              />
            </SectionCard>
          </div>

          <ProvisioningSummary
            draft={draft}
            options={options}
            hasCatalogue={hasCatalogue}
            isReady={isReady}
            isSubmitting={provision.isLoading}
            failure={submissionField ? null : submissionFailure}
          />
        </div>
      </form>
    </PageContainer>
  );
}

/**
 * Leaving the workspace.
 *
 * An untouched form goes straight back — asking someone to confirm discarding
 * nothing is noise that teaches them to dismiss the dialog without reading it.
 * Once real work exists, the confirmation is worth the interruption, because
 * nothing here is saved until provisioning commits.
 */
function BackToTenants({ href, isDirty }: { href: string; isDirty: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  return (
    <>
      <Button
        asChild={!isDirty}
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        {...(isDirty ? { onClick: () => setAsking(true) } : {})}
      >
        {isDirty ? (
          <>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Tenants
          </>
        ) : (
          <Link href={href}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Tenants
          </Link>
        )}
      </Button>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing has been provisioned yet. Leaving now discards what you
              have entered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(href)}>
              Discard and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * A section of the decision, headed by what it is about rather than by its
 * position. There are no step numbers and no completion ticks: every section is
 * always editable and they are submitted together, so implying an order would
 * describe a workflow this page does not have.
 */
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = `section-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-border bg-card"
    >
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

/**
 * The commitment, restated where it is made.
 *
 * It separates what was decided from what will result: the tenant's status and
 * identifier do not exist yet, so they sit under a heading that says as much
 * rather than being listed alongside entered values as though already true.
 */
function ProvisioningSummary({
  draft,
  options,
  hasCatalogue,
  isReady,
  isSubmitting,
  failure,
}: {
  draft: ProvisioningDraft;
  options: ProvisioningModuleOption[];
  hasCatalogue: boolean;
  isReady: boolean;
  isSubmitting: boolean;
  failure: Error | null;
}) {
  const included = useMemo(
    () => options.filter((option) => option.availability === "included"),
    [options]
  );
  const selected = useMemo(
    () =>
      options.filter(
        (option) =>
          option.availability === "selectable" &&
          draft.selectedModuleKeys.includes(option.key)
      ),
    [options, draft.selectedModuleKeys]
  );

  // Constructs an `Intl.DateTimeFormat`, and this summary re-renders on every
  // keystroke in the name and email fields.
  const offset = useMemo(() => timeZoneOffset(draft.timeZone), [draft.timeZone]);

  return (
    <aside
      aria-labelledby="provisioning-summary-title"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-6"
    >
      <h2
        id="provisioning-summary-title"
        className="border-b border-border px-5 py-3.5 text-sm font-semibold text-foreground"
      >
        Provisioning summary
      </h2>

      <div className="space-y-4 px-5 py-4">
        <SummaryGroup label="Decision">
          <SummaryRow label="Tenant" value={draft.name.trim()} />
          <SummaryRow
            label="Initial administrator"
            value={draft.administratorEmail.trim()}
          />
        </SummaryGroup>

        <SummaryGroup label="Configuration">
          <SummaryRow
            label="Regional defaults"
            // The offset is carried through, because a zone name alone is not
            // what most people verify a time zone by.
            value={`${labelForTimeZone(draft.timeZone)} (${offset}) · ${
              draft.locale === PLATFORM_DEFAULT_LOCALE
                ? "Platform default"
                : labelForLocale(draft.locale)
            }`}
          />
          <EntitlementRow
            included={included}
            selected={selected}
            hasCatalogue={hasCatalogue}
          />
        </SummaryGroup>

        {/* Stated as a consequence, not as current truth. */}
        <SummaryGroup label="After provisioning">
          <SummaryRow
            label="Tenant status"
            value="Awaiting administrator activation"
          />
          <SummaryRow label="Tenant ID" value="Generated automatically" muted />
        </SummaryGroup>
      </div>

      <div className="border-t border-border px-5 py-4">
        {failure ? <SubmissionFailure error={failure} /> : null}

        <AsyncButton
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isReady}
          pending={isSubmitting}
        >
          Provision tenant
        </AsyncButton>

        {!isReady && !isSubmitting ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {hasCatalogue
              ? "Enter a tenant name and administrator email to continue."
              : "Module entitlements must load before a tenant can be provisioned."}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function SummaryGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  // "Not entered" rather than a dash: a dash could mean empty, unknown, or not
  // applicable, and the operator is about to commit to this.
  const isEmpty = value.trim().length === 0;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      {/* Values wrap rather than truncate: a clipped decision summary is worse
          than a taller one. */}
      <dd
        className={cn(
          "min-w-0 [overflow-wrap:anywhere] text-right font-medium",
          isEmpty || muted ? "text-muted-foreground" : "text-foreground",
          isEmpty && "italic"
        )}
      >
        {isEmpty ? "Not entered" : value}
      </dd>
    </div>
  );
}

/**
 * Entitlements read as a phrase while they stay short, and collapse to a count
 * with a disclosure once naming them all would crowd the summary. Unavailable
 * modules can never appear here — they are not in the selected set.
 */
function EntitlementRow({
  included,
  selected,
  hasCatalogue,
}: {
  included: ProvisioningModuleOption[];
  selected: ProvisioningModuleOption[];
  hasCatalogue: boolean;
}) {
  // Before the catalogue is read the entitlements are genuinely unknown, and a
  // blank value would read as "none" — which is both wrong and the one reading
  // that would let an operator commit without noticing.
  if (!hasCatalogue) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <dt className="shrink-0 text-muted-foreground">Entitlements</dt>
        <dd className="min-w-0 text-right italic font-medium text-muted-foreground">
          Not loaded
        </dd>
      </div>
    );
  }

  const includedNames = included.map((option) => option.label);
  const selectedNames = selected.map((option) => option.label);
  const all = [...includedNames, ...selectedNames];

  const isCompact = selectedNames.length > 2;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">Entitlements</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">
        {isCompact ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {includedNames.join(" + ")} + {selectedNames.length} optional
                modules
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Entitlements
              </p>
              <ul className="space-y-1.5 text-left text-sm">
                {all.map((name) => (
                  <li key={name} className="text-foreground">
                    {name}
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        ) : (
          all.join(" + ")
        )}
      </dd>
    </div>
  );
}

/**
 * What a refused submission actually tells the operator.
 *
 * The distinction that matters is whether the outcome is known. Provisioning
 * commits the tenant before the response is returned, so a timeout or a gateway
 * failure can arrive after the tenant exists. Claiming "no tenant was created"
 * there would be a guarantee this page cannot make, and acting on it — starting
 * again with different details — is how an estate ends up with a stranded
 * tenant nobody is looking for.
 *
 * Validation and permission failures are different: those are refused before
 * anything is committed, so they can safely say so. For the ambiguous ones the
 * honest instruction is to retry unchanged, which reuses the same idempotency
 * key and therefore either completes the original request or returns its
 * existing result rather than provisioning a second tenant.
 */
function SubmissionFailure({ error }: { error: Error }) {
  const kind = failureKind(error);
  const message =
    kind === "permission"
      ? "Your Platform administration access has changed. Sign in again to provision a tenant."
      : kind === "validation"
        ? (failureMessage(error) ??
          "The request was rejected before anything was created. Your entries are kept.")
        : kind === "conflict"
          ? (failureMessage(error) ??
            "This request conflicts with one already recorded.")
          : kind === "unavailable"
            ? "Provisioning did not complete and the outcome is unknown. Submit again without changing anything — the retry is safe and will not create a second tenant. If it keeps failing, check the tenant list before entering different details."
            : (failureMessage(error) ??
              "Provisioning did not complete and the outcome is unknown. Submit again without changing anything — the retry is safe and will not create a second tenant.");

  return (
    <p
      role="alert"
      className="mb-3 flex items-start gap-2 text-sm text-destructive"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function describedBy(id: string, hasError: boolean): string | undefined {
  const ids = [`${id}-hint`, hasError ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {/* The asterisk is decorative; the requirement is announced by the
            input's own validity, and spelled out for anyone reading the label. */}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </Label>

      {children}

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}


/**
 * One key per distinct request. Retrying an unchanged request reuses it, so a
 * repeat cannot provision twice; editing and resubmitting earns a new one, so
 * the changed request is not refused as a conflicting reuse of the old key.
 */
function useIdempotencyKey(draft: ProvisioningDraft): string {
  const keyRef = useRef<string>("");
  const signatureRef = useRef<string | null>(null);
  const signature = JSON.stringify(draft);

  if (signatureRef.current !== signature) {
    signatureRef.current = signature;
    keyRef.current = createKey();
  }

  return keyRef.current;
}

function createKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Whether leaving would actually lose something.
 *
 * The regional defaults arrive pre-filled — one from the platform, one from the
 * browser's own zone — so their presence is not evidence of a decision. Only a
 * value the operator supplied or changed counts.
 */
function hasMeaningfulEdits(
  draft: ProvisioningDraft,
  defaultTimeZone: string
): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.administratorEmail.trim().length > 0 ||
    draft.selectedModuleKeys.length > 0 ||
    draft.locale !== DEFAULT_LOCALE ||
    draft.timeZone !== defaultTimeZone
  );
}

/** Only warns when something typed would actually be lost. */
function useUnsavedWorkGuard(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}

function focusFirstInvalid(errors: FieldErrors) {
  const order = ["name", "administratorEmail", "timeZone", "locale"] as const;
  const ids: Record<(typeof order)[number], string> = {
    name: "tenant-name",
    administratorEmail: "administrator-email",
    timeZone: "tenant-time-zone",
    locale: "tenant-locale",
  };

  const first = order.find((field) => errors[field]);
  if (first) {
    document.getElementById(ids[first])?.focus();
  }
}
