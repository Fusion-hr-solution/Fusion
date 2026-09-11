"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
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
import { toast } from "sonner";
import { PageContainer } from "@repo/ds/shell";
import { useProvisionableModules, useProvisionTenant } from "../queries";
import { buildModuleOptions, selectedModulesFor } from "./module-catalogue";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  resolveInitialTimeZone,
} from "./provisioning-options";
import {
  DEFAULT_COUNTRY,
  DEFAULT_DATE_FORMAT,
} from "./regional-presentation-options";
import { DEFAULT_ADMIN_ROLE } from "./admin-role-options";
import { PROVISIONING_STEPS, ProvisioningStepper } from "./provision-stepper";
import { StepNavigation } from "./step-navigation";
import { OrganizationStep } from "./steps/organization-step";
import { RegionProductsStep } from "./steps/region-products-step";
import { InitialAdminStep } from "./steps/initial-admin-step";
import { ReviewStep } from "./steps/review-step";
import type { ProvisioningStepProps } from "./steps/types";
import { failureMessage } from "../api";
import {
  fieldForFailure,
  validateDraft,
  type FieldErrors,
  type ProvisioningDraft,
} from "./provisioning-form-state";

/** The step rendered at each index, aligned with {@link PROVISIONING_STEPS}. */
const STEP_COMPONENTS = [
  OrganizationStep,
  RegionProductsStep,
  InitialAdminStep,
  ReviewStep,
] as const;

/**
 * Which draft fields each step is responsible for. Continuing past a step
 * requires its own fields to be valid; nothing further ahead is judged, and the
 * final step owns no field of its own because it only confirms.
 */
const STEP_FIELDS: (keyof FieldErrors)[][] = [
  ["name", "tenantSlug"],
  ["timeZone", "locale"],
  ["firstName", "lastName", "administratorEmail"],
  [],
];

/**
 * Provisioning a tenant, as a wizard.
 *
 * The decision is broken into four steps in the order they are made. The
 * workspace owns the whole draft, the validation, and the navigation; each step
 * renders only its slice and reports edits back, so a step can be built or
 * refined on its own. Success is a destination rather than a message — the
 * tenant's own record is the authoritative result, so the page navigates
 * straight to it.
 */
export function ProvisionTenantWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<ProvisioningDraft>({
    name: "",
    tenantSlug: "",
    legalEntityName: "",
    internalReferenceCode: "",
    shortDescription: "",
    timeZone: DEFAULT_TIME_ZONE,
    locale: DEFAULT_LOCALE,
    country: DEFAULT_COUNTRY,
    dateFormat: DEFAULT_DATE_FORMAT,
    firstName: "",
    lastName: "",
    adminRole: DEFAULT_ADMIN_ROLE,
    sendInvitation: true,
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

  const idempotencyKey = useIdempotencyKey(draft);

  // Success is continuous: the request runs with the button in its pending
  // state, then the operator lands on the tenant's own record with a toast
  // confirming what happened — no interstitial dialog to dismiss.
  const provision = useProvisionTenant(
    (tenantId) => {
      const invitee =
        [draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(" ") ||
        draft.administratorEmail.trim();
      toast.success("Tenant provisioned", {
        description: `${draft.name.trim()} is ready.${
          invitee ? ` ${invitee} has been invited as tenant administrator.` : ""
        }`,
      });
      router.push(`/tenants/${tenantId}`);
    },
    // A refused submit is put back where it can be fixed: a failure the server
    // ties to a field (a duplicate name, a rejected email) sets that field's
    // error and returns the operator to the step that owns it, using the
    // server's own message. Failures with no field (a reused key, an
    // unreachable service) stay on Review, where the banner and toast explain
    // that the outcome is unknown and a plain retry is safe.
    (error) => {
      const field = fieldForFailure(error);
      if (field) {
        const message =
          failureMessage(error) ?? "This value was rejected. Adjust it and try again.";
        setErrors((current) => ({ ...current, [field]: message }));
        const step = STEP_FIELDS.findIndex((fields) => fields.includes(field));
        if (step >= 0) setCurrentStep(step);
        return;
      }
      toast.error("Tenant not provisioned", {
        description:
          "The request did not complete. Review the details below and try again.",
      });
    }
  );

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

  const isLast = currentStep === PROVISIONING_STEPS.length - 1;
  const isFirst = currentStep === 0;

  const found = validateDraft(draft);

  // The catalogue is a provisioning dependency, not decoration: until it is
  // read the page cannot say which modules the tenant would be entitled to, so
  // committing would mean approving a summary that may not match the result.
  const hasCatalogue = Boolean(catalogue.data);
  const isReady = hasCatalogue && Object.keys(found).length === 0;

  function goBack() {
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  /**
   * The forward action. Advancing is never blocked — the operator can move
   * through the steps in any order. Only the final commit holds out for a
   * valid, fully-loaded draft, and if anything is invalid it returns to the
   * step that owns the problem rather than failing silently.
   */
  function onPrimary() {
    if (!isLast) {
      setCurrentStep((step) => step + 1);
      return;
    }

    if (provision.isLoading) {
      return;
    }

    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const invalidStep = STEP_FIELDS.findIndex((fields) =>
        fields.some((field) => nextErrors[field])
      );
      if (invalidStep >= 0) setCurrentStep(invalidStep);
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

  const StepComponent = STEP_COMPONENTS[currentStep] ?? OrganizationStep;
  const stepProps: ProvisioningStepProps = {
    draft,
    errors,
    update,
    validateField,
    toggleModule,
  };

  return (
    <PageContainer width="default">
      <div className="mx-auto max-w-5xl">
        <BackToTenants href={returnHref} isDirty={isDirty} />

        <header className="mb-6">
          <h1 className="type-page-title text-foreground">Provision tenant</h1>
          <p className="type-body-secondary mt-1 text-muted-foreground">
            Set up a new tenant for your organization.
          </p>
        </header>

        <ProvisioningStepper
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          className="mb-8"
        />

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onPrimary();
          }}
          noValidate
        >
          {isLast ? (
            // The final step commits, so its primary action — and any refusal of
            // it — live inside the review panel rather than in the shared bar.
            <ReviewStep
              {...stepProps}
              onEditStep={setCurrentStep}
              onProvision={onPrimary}
              canProvision={isReady}
              provisionPending={provision.isLoading}
              provisionFailure={submissionField ? null : submissionFailure}
            />
          ) : (
            <>
              <StepComponent {...stepProps} />

              <StepNavigation
                isFirst={isFirst}
                isLast={isLast}
                onBack={goBack}
                onPrimary={onPrimary}
                // Forward movement is never blocked; the commit lives on the
                // review step, so this bar never carries it.
                primaryDisabled={false}
                primaryPending={provision.isLoading}
                failure={null}
              />
            </>
          )}
        </form>
      </div>
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
    draft.tenantSlug.trim().length > 0 ||
    draft.legalEntityName.trim().length > 0 ||
    draft.internalReferenceCode.trim().length > 0 ||
    draft.shortDescription.trim().length > 0 ||
    draft.administratorEmail.trim().length > 0 ||
    draft.selectedModuleKeys.length > 0 ||
    draft.locale !== DEFAULT_LOCALE ||
    draft.timeZone !== defaultTimeZone ||
    draft.country !== DEFAULT_COUNTRY ||
    draft.dateFormat !== DEFAULT_DATE_FORMAT ||
    draft.firstName.trim().length > 0 ||
    draft.lastName.trim().length > 0 ||
    draft.adminRole !== DEFAULT_ADMIN_ROLE ||
    draft.sendInvitation !== true
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
