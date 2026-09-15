"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  Spinner,
  cn,
} from "@repo/ds";
import {
  InvitationContextPanel,
  InvitationTerminalCard,
  InvitationTransactionFrame,
  InvitationTransactionLoading,
  InvitationTransactionTerminalFrame,
  PasswordStrengthField,
} from "@repo/ds/shell";
import { persistAuth } from "@repo/auth";
import {
  ArrowRight,
  Ban,
  Building2,
  Check,
  CircleCheck,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  TriangleAlert,
  UserX,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  BOOTSTRAP_JOURNEY,
  journeyTerminalState,
  type ActivationEntry,
  type ActivationJourney,
  type ActivationFieldError,
  type ActivationForm,
  type ActivationOutcome,
  errorFor,
  passwordChecks,
  validateForm,
} from "../../lib/activation";

type Phase =
  | { kind: "loading" }
  | { kind: "form"; entry: ActivationEntry }
  | { kind: "terminal"; outcome: ActivationOutcome };

/**
 * The one administrator-account journey, shared by the tenant's first
 * activation, an invitation from an existing administrator, and Platform
 * recovery. The variant supplies the endpoint and the words; the credential
 * handling, account creation, and session handoff are identical by design.
 */
export function ActivateInvitation({
  journey = BOOTSTRAP_JOURNEY,
}: {
  journey?: ActivationJourney;
} = {}) {
  const searchParams = useSearchParams();

  // Read once and held. Scrubbing the address bar changes the search params, so
  // reading them on every render would hand the request an empty credential the
  // moment the credential is removed from the URL.
  const [credential] = useState(() => searchParams.get("credential") ?? "");

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function inspect() {
      try {
        const response = await fetch(
          `${journey.inspectPath}?credential=${encodeURIComponent(credential)}`,
          { headers: { Accept: "application/json" }, cache: "no-store" }
        );
        const body = await response.json();
        const entry = body?.data as ActivationEntry | undefined;

        if (cancelled) return;

        if (!entry) {
          setPhase({ kind: "terminal", outcome: "unavailable" });
          return;
        }

        setPhase(
          entry.state === "account_creation"
            ? { kind: "form", entry }
            : { kind: "terminal", outcome: entry.state }
        );
      } catch {
        if (!cancelled) setPhase({ kind: "terminal", outcome: "unavailable" });
      }
    }

    void inspect();
    return () => {
      cancelled = true;
    };
  }, [credential, journey.inspectPath]);

  // A terminal invitation carries no tenant name — the service withholds it so a
  // wrong credential cannot be used to discover which tenants exist. With nothing
  // to put in the context panel, those states use the focused single column
  // instead of a split with an empty half.
  if (phase.kind === "terminal") {
    return (
      <InvitationTransactionTerminalFrame>
        <Terminal outcome={phase.outcome} journey={journey} />
      </InvitationTransactionTerminalFrame>
    );
  }

  if (phase.kind === "loading") {
    return <InvitationTransactionLoading />;
  }

  return (
    <InvitationTransactionFrame
      context={<TenantContext entry={phase.entry} journey={journey} />}
    >
      <AccountForm
        entry={phase.entry}
        credential={credential}
        journey={journey}
        onTerminal={(outcome) => setPhase({ kind: "terminal", outcome })}
      />
    </InvitationTransactionFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Context panel                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The invitation as an orientation, not a form: who invited the recipient, into
 * which organization, with which access, sent to which address. Each fact is
 * stated once, plainly, so the recipient can check the invitation is theirs
 * before choosing a password on the other half of the split.
 */
function TenantContext({
  entry,
  journey,
}: {
  entry: ActivationEntry;
  journey: ActivationJourney;
}) {
  const tenantName = entry.tenantName ?? "your organization";
  // Prefer the role the invitation carries when it is a presentable label;
  // fall back to the journey's default rather than surfacing a raw role key.
  const role =
    entry.role && entry.role.includes(" ") ? entry.role : journey.roleLabel;

  return (
    <InvitationContextPanel
      eyebrow="You're invited"
      // The organization carries the display size: it is what the recipient
      // is checking, so the tenant is the hero.
      heading={`Join ${tenantName}`}
      lead={`You've been invited to set up your Fusion account and get started with ${tenantName}.`}
      rows={[
        { icon: Building2, label: "Organization", value: tenantName },
        { icon: Users, label: "Assigned role", value: role },
        ...(entry.invitedEmail
          ? [
              {
                icon: Mail,
                label: "Invitation sent to",
                value: entry.invitedEmail,
              },
            ]
          : []),
      ]}
      securityNote="This invitation is secure and tied to the invited email address. Only the intended recipient can use this link."
      footerLabel="People work together"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Terminal states                                                            */
/* -------------------------------------------------------------------------- */

/** One semantic glyph per stopping point, so the state reads before the words do. */
const TERMINAL_ICON: Record<string, LucideIcon> = {
  expired: Clock,
  revoked: Ban,
  superseded: RefreshCw,
  already_accepted: CircleCheck,
  existing_account: UserX,
  session_unavailable: CircleCheck,
};

/** Only the two states where activation actually succeeded read as resolved. */
const RESOLVED = new Set(["already_accepted", "session_unavailable"]);

function Terminal({
  outcome,
  journey,
}: {
  outcome: ActivationOutcome;
  journey: ActivationJourney;
}) {
  const state = journeyTerminalState(journey, outcome);

  return (
    <InvitationTerminalCard
      variant={RESOLVED.has(outcome) ? "resolved" : "error"}
      icon={TERMINAL_ICON[outcome] ?? TriangleAlert}
      title={state.title}
      detail={state.detail}
      action={state.action}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Account form                                                               */
/* -------------------------------------------------------------------------- */

function AccountForm({
  entry,
  credential,
  journey,
  onTerminal,
}: {
  entry: ActivationEntry;
  credential: string;
  journey: ActivationJourney;
  onTerminal: (outcome: ActivationOutcome) => void;
}) {
  const [form, setForm] = useState<ActivationForm>(() => ({
    firstName: entry.firstName ?? "",
    lastName: entry.lastName ?? "",
    password: "",
    confirmPassword: "",
  }));
  const [errors, setErrors] = useState<ActivationFieldError[]>([]);
  const [revealConfirm, setRevealConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [retryable, setRetryable] = useState<string | null>(null);

  const summaryRef = useRef<HTMLDivElement>(null);
  const checks = passwordChecks(form.password, entry.passwordRequirements);
  const passwordsMatch =
    Boolean(form.password) && form.confirmPassword === form.password;
  const passwordError = errorFor(errors, "password");
  const confirmError = errorFor(errors, "confirmPassword");
  const tenantName = entry.tenantName ?? "your organization";
  const lead = journey.formLead.replace("{tenant}", tenantName);

  // The CTA is only actionable once every field the recipient controls is
  // valid; the service still revalidates on submit.
  const canSubmit =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.password.length > 0 &&
    checks.every((check) => check.satisfied) &&
    passwordsMatch;

  const update = useCallback(
    (field: keyof ActivationForm, value: string) =>
      setForm((current) => ({ ...current, [field]: value })),
    []
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found = validateForm(form, entry.passwordRequirements);
    setErrors(found);
    setRetryable(null);
    if (found.length > 0) return;

    setPending(true);
    try {
      const response = await fetch(journey.acceptPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          credential,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          password: form.password,
        }),
      });

      const body = await response.json().catch(() => null);

      if (response.ok && body?.data?.accessToken) {
        const session = body.data;
        persistAuth({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          accessTokenExpiration: session.accessTokenExpiration,
          user: {
            userId: session.userId,
            tenantId: session.tenantId ?? null,
            tenantMembershipId: session.tenantMembershipId ?? null,
            moduleEntitlements: session.moduleEntitlements ?? [],
            email: session.email,
            fullName: session.fullName,
            roles: session.roles ?? [],
            employeeId: session.employeeId ?? null,
            accessProfiles: session.accessProfiles ?? [],
            effectivePermissions: session.effectivePermissions ?? [],
          },
        });

        // A full document load, so the shell and Core start from the new
        // tenant-scoped session rather than from state this page was holding.
        window.location.assign(journey.destination);
        return;
      }

      const reason = body?.data?.reason as string | undefined;

      if (reason === "invalid_details") {
        const fields = (body?.data?.fieldErrors ??
          []) as ActivationFieldError[];
        setErrors(
          fields.length > 0
            ? fields
            : [
                {
                  field: "password",
                  message: "This password was not accepted.",
                },
              ]
        );
        setPending(false);
        summaryRef.current?.focus();
        return;
      }

      if (
        reason === "existing_account" ||
        reason === "already_accepted" ||
        reason === "expired" ||
        reason === "revoked" ||
        reason === "superseded" ||
        reason === "invalid" ||
        // The invitation stopped being usable between rendering this form and
        // submitting it. Terminal, not retryable — offering the form again would
        // send the recipient back to a link that cannot work.
        reason === "not_activatable" ||
        reason === "not_acceptable" ||
        reason === "session_unavailable"
      ) {
        onTerminal(reason);
        return;
      }

      // Nothing about the invitation changed, so the recipient keeps their form
      // and can try again without retyping.
      setRetryable("Your account could not be created just now. Try again.");
      setPending(false);
    } catch {
      setRetryable("Your account could not be created just now. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <header>
        <h2 className="font-heading text-[1.875rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
          {journey.formHeading}
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">
          {lead}
        </p>
      </header>

      {retryable ? (
        <Alert
          ref={summaryRef}
          tabIndex={-1}
          variant="destructive"
          className="mt-6 border-destructive/30 bg-destructive/10"
        >
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {retryable}
          </AlertDescription>
        </Alert>
      ) : (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="sr-only" />
      )}

      <FieldGroup className="mt-6 gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="firstName"
            label="First name"
            autoComplete="given-name"
            value={form.firstName}
            error={errorFor(errors, "firstName")}
            onChange={(value) => update("firstName", value)}
          />
          <TextField
            id="lastName"
            label="Last name"
            autoComplete="family-name"
            value={form.lastName}
            error={errorFor(errors, "lastName")}
            onChange={(value) => update("lastName", value)}
          />
        </div>

        {entry.invitedEmail ? (
          <Field>
            <FieldLabel htmlFor="workEmail">Work email</FieldLabel>
            {/* The invited address as a fact, not a field to change. It is shown
                so the recipient can confirm the invitation is theirs and see the
                address they will sign in with. */}
            <InputGroup className="h-11 bg-muted/40 dark:bg-muted/40">
              <InputGroupInput
                id="workEmail"
                type="email"
                value={entry.invitedEmail}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                autoComplete="email"
                className="text-muted-foreground"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="text-[0.6875rem] font-medium uppercase tracking-[0.1em]">
                  Read only
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        ) : null}

        <PasswordStrengthField
          id="password"
          label="Create password"
          value={form.password}
          checks={checks}
          error={passwordError}
          onChange={(value) => update("password", value)}
        />

        <Field data-invalid={confirmError ? true : undefined}>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="confirmPassword"
              type={revealConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              aria-invalid={Boolean(confirmError)}
              onChange={(event) =>
                update("confirmPassword", event.target.value)
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                onClick={() => setRevealConfirm((shown) => !shown)}
                aria-label={
                  revealConfirm ? "Hide characters" : "Show characters"
                }
              >
                {revealConfirm ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {/* A quiet match indicator, shown once the recipient starts confirming. */}
          {form.confirmPassword.length > 0 ? (
            <p
              className={cn(
                "flex items-center gap-2 text-xs",
                passwordsMatch ? "text-success" : "text-muted-foreground"
              )}
            >
              {passwordsMatch ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <X aria-hidden="true" className="size-3.5 text-muted-foreground/60" />
              )}
              {passwordsMatch ? "Passwords match" : "Passwords do not match yet"}
            </p>
          ) : null}
          {confirmError ? <FieldError>{confirmError}</FieldError> : null}
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={pending || !canSubmit}
          aria-busy={pending}
          aria-label={pending ? "Set up account" : undefined}
          className="relative h-12 w-full text-[0.9375rem] font-semibold"
        >
          <span
            className={cn("inline-flex items-center gap-2", pending && "invisible")}
            aria-hidden={pending}
          >
            Set up account
            <ArrowRight />
          </span>
          {pending ? (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner aria-hidden="true" />
            </span>
          ) : null}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have a Fusion account?{" "}
          <a
            href="/auth/signin"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </a>{" "}
          to continue
        </p>
      </FieldGroup>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className="h-11"
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
