"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label, Spinner, cn } from "@repo/ds";
import {
  InvitationTransactionFrame,
  InvitationTransactionLoading,
  InvitationTransactionTerminalFrame,
  InvitationWordmark,
} from "@repo/ds/shell";
import { persistAuth } from "@repo/auth";
import {
  ArrowRight,
  Ban,
  Check,
  CircleCheck,
  Clock,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  TriangleAlert,
  UserX,
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
  formatExpiry,
  monogramFor,
  passwordChecks,
  scrubbedUrl,
  validateForm,
} from "../../lib/activation";

/**
 * The context panel is ink in both themes.
 *
 * It is the one surface on this page that does not follow the theme: an
 * invitation arrives cold, from an organization the recipient may not yet
 * recognise, and the ink half gives the page a fixed centre of gravity that
 * reads the same whichever theme the recipient's browser asks for. The shared
 * invitation frame owns that fixed surface across every invitation purpose.
 */
const PANEL_MUTED = "text-[hsl(240_8%_67%)]";
const PANEL_RULE = "border-[hsl(240_8%_22%)]";

/**
 * Amber appears exactly twice: the tenant's mark on the ink panel and the
 * primary action on the form panel. One on each side of the split, which is what
 * ties the two halves together — nothing else on the page is allowed to use it.
 */
const AMBER_TILE = "bg-[hsl(47_100%_52%)] text-[hsl(29_83%_20%)]";

/**
 * A focus ring the brand can own without losing the contrast a focus indicator
 * has to carry: amber is too light against either canvas to be the boundary on
 * its own, so the border goes to full foreground and the amber ring sits outside
 * it. The pair reads as one brand-coloured focus state and still clears 3:1.
 */
const FIELD =
  "h-11 rounded-xl border-input/80 bg-background transition " +
  "hover:border-foreground/30 " +
  "focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-primary " +
  "focus-visible:ring-offset-0 focus-visible:shadow-none " +
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 " +
  "aria-[invalid=true]:ring-destructive/20";

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

  // Read once, then removed from the address bar, history and anything the
  // recipient copies from it.
  useEffect(() => {
    if (!credential) return;
    const cleaned = scrubbedUrl(window.location.href);
    if (cleaned) window.history.replaceState(null, "", cleaned);
  }, [credential]);

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
/* Frames                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The account-creation composition: invitation context on one side, the task on
 * the other.
 *
 * The split exists from `lg` up, where there is room for both halves to be read
 * at once. Below that the two stack in the order the recipient needs them —
 * whose invitation this is, then what to do about it — and the ink panel keeps
 * the boundary between reading and acting legible in the stack.
 */
/** The terminal states, which have no second half to show. */
function Wordmark({ className }: { className?: string }) {
  return <InvitationWordmark className={className} />;
}

/* -------------------------------------------------------------------------- */
/* Context panel                                                              */
/* -------------------------------------------------------------------------- */

function TenantContext({
  entry,
  journey,
}: {
  entry: ActivationEntry;
  journey: ActivationJourney;
}) {
  const tenantName = entry.tenantName ?? "";
  const expiry = formatExpiry(entry.expiresAt);

  return (
    <div className="mx-auto flex h-full max-w-[34rem] flex-col lg:max-w-[33rem]">
      <Wordmark />

      <MonogramTile
        tenantName={tenantName}
        className="mt-12 size-12 rounded-xl text-base lg:hidden"
      />

      {/* The sentence is split by weight: what is happening is stated plainly,
          and the organization it is happening for carries the display size. The
          tenant is what the recipient is checking, so the tenant is the hero. */}
      <h1 className="mt-6 lg:mt-16">
        <span
          className={cn("block text-lg font-normal lg:text-xl", PANEL_MUTED)}
        >
          {journey.contextLead}
        </span>
        <span className="mt-2 block break-words text-[2rem] font-semibold leading-[1.08] tracking-[-0.025em] lg:mt-3 lg:text-[3rem]">
          {tenantName}
        </span>
      </h1>

      <p
        className={cn(
          "mt-6 max-w-[46ch] text-sm leading-7 lg:text-base",
          PANEL_MUTED
        )}
      >
        {journey.contextBody}
      </p>

      <TenantSigil tenantName={tenantName} />

      <dl
        className={cn(
          "mt-12 grid gap-6 border-t pt-7 text-sm sm:grid-cols-2 lg:mt-0",
          PANEL_RULE
        )}
      >
        <div>
          <dt
            className={cn("text-xs uppercase tracking-[0.12em]", PANEL_MUTED)}
          >
            Access granted
          </dt>
          <dd className="mt-2 font-medium">Administrator</dd>
        </div>
        {expiry ? (
          <div>
            <dt
              className={cn("text-xs uppercase tracking-[0.12em]", PANEL_MUTED)}
            >
              Invitation expires
            </dt>
            <dd className="mt-2 font-medium">{expiry}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/**
 * The tenant's mark held inside concentric frames.
 *
 * Decorative, and deliberately so: it is geometry and the tenant's own initials,
 * not a badge, a seal, or an implied capability. It occupies the space the
 * desktop composition would otherwise leave empty between the invitation and the
 * facts beneath it, and it is absent below `lg` where that space does not exist.
 */
function TenantSigil({ tenantName }: { tenantName: string }) {
  return (
    <div
      aria-hidden="true"
      className="my-14 hidden flex-1 place-items-center lg:grid"
    >
      <div className="relative grid aspect-square w-full max-w-[19rem] place-items-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700">
        <span className="absolute inset-0 rounded-[2.5rem] border border-white/[0.07]" />
        <span className="absolute inset-[13%] rounded-[2rem] border border-white/[0.11]" />
        <span className="absolute inset-[26%] rounded-[1.5rem] border border-white/[0.16] bg-white/[0.03]" />
        <MonogramTile
          tenantName={tenantName}
          className="relative size-[30%] rounded-2xl text-[clamp(1.375rem,2.4vw,1.875rem)] shadow-[0_0_5rem_-0.5rem_hsl(47_100%_50%/0.55)]"
        />
      </div>
    </div>
  );
}

function MonogramTile({
  tenantName,
  className,
}: {
  tenantName: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid place-items-center font-semibold tracking-tight",
        AMBER_TILE,
        className
      )}
    >
      {monogramFor(tenantName)}
    </span>
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
  const Icon = TERMINAL_ICON[outcome] ?? TriangleAlert;
  const resolved = RESOLVED.has(outcome);

  return (
    <div>
      <IconChip
        icon={Icon}
        className={cn(
          "size-12 rounded-2xl",
          resolved
            ? "bg-foreground/[0.06] text-foreground ring-1 ring-inset ring-foreground/10"
            : "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20"
        )}
        iconClassName="size-[1.375rem]"
      />

      <h1 className="mt-6 text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
        {state.title}
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-7 text-muted-foreground">
        {state.detail}
      </p>

      {state.action ? (
        <Button
          asChild
          className="group mt-8 h-11 rounded-xl px-5 font-semibold shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99]"
        >
          <a href={state.action.href}>
            {state.action.label}
            <ArrowRight
              aria-hidden="true"
              className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function IconChip({
  icon: Icon,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center", className)}>
      <Icon aria-hidden="true" className={cn("size-4", iconClassName)} />
    </span>
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
  const [form, setForm] = useState<ActivationForm>({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<ActivationFieldError[]>([]);
  const [revealPassword, setRevealPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [retryable, setRetryable] = useState<string | null>(null);

  const summaryRef = useRef<HTMLParagraphElement>(null);
  const checks = passwordChecks(form.password, entry.passwordRequirements);
  const passwordError = errorFor(errors, "password");
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
      <h2 className="text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
        {journey.formHeading}
      </h2>

      <InvitedAddress email={entry.invitedEmail} />

      {retryable ? (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm leading-6 text-destructive"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {retryable}
        </p>
      ) : (
        <p ref={summaryRef} tabIndex={-1} role="alert" className="sr-only" />
      )}

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field
          id="firstName"
          label="First name"
          autoComplete="given-name"
          value={form.firstName}
          error={errorFor(errors, "firstName")}
          onChange={(value) => update("firstName", value)}
        />
        <Field
          id="lastName"
          label="Last name"
          autoComplete="family-name"
          value={form.lastName}
          error={errorFor(errors, "lastName")}
          onChange={(value) => update("lastName", value)}
        />
      </div>

      <div className="mt-5">
        <Label htmlFor="password" className="text-[0.8125rem] text-foreground">
          Create password
        </Label>
        <div className="relative mt-2">
          <Input
            id="password"
            type={revealPassword ? "text" : "password"}
            autoComplete="new-password"
            className={cn(FIELD, "pr-11")}
            value={form.password}
            aria-invalid={Boolean(passwordError)}
            aria-describedby="password-requirements"
            onChange={(event) => update("password", event.target.value)}
          />
          <button
            type="button"
            onClick={() => setRevealPassword((shown) => !shown)}
            aria-label={revealPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-1.5 right-1.5 grid w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {revealPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* The enforced policy as checkable state rather than a strength meter:
            every line here is a rule the service will actually apply, and each
            one fills in as it is met. */}
        <ul
          id="password-requirements"
          className="mt-3.5 grid gap-2 rounded-xl border bg-muted/40 px-3.5 py-3 sm:grid-cols-2"
        >
          {checks.map((check) => (
            <li
              key={check.label}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                check.satisfied
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {/* Unmet is a dot, not an empty ring: a row of hollow circles
                  reads as a set of radio buttons waiting to be chosen, and
                  these are not the recipient's to choose. */}
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full transition-colors",
                  check.satisfied && "bg-primary text-[hsl(29_83%_20%)]"
                )}
              >
                {check.satisfied ? (
                  <Check className="size-2.5" strokeWidth={3.5} />
                ) : (
                  <span className="size-1 rounded-full bg-foreground/30" />
                )}
              </span>
              <span>
                {check.label}
                <span className="sr-only">
                  {check.satisfied ? " — met" : " — not yet met"}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <FieldError message={passwordError} />
      </div>

      <div className="mt-5">
        <Field
          id="confirmPassword"
          label="Confirm password"
          type={revealPassword ? "text" : "password"}
          autoComplete="new-password"
          value={form.confirmPassword}
          error={errorFor(errors, "confirmPassword")}
          onChange={(value) => update("confirmPassword", value)}
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-label={pending ? "Create account and continue" : undefined}
        className="group relative mt-8 h-12 w-full rounded-xl text-[0.9375rem] font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/35 active:scale-[0.995] disabled:shadow-none"
      >
        <span
          className={cn("inline-flex items-center", pending && "invisible")}
          aria-hidden={pending}
        >
          Create account and continue
          <ArrowRight
            aria-hidden="true"
            className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner aria-hidden="true" />
          </span>
        ) : null}
      </Button>
    </form>
  );
}

/**
 * The address the invitation was sent to, as a fact rather than a field.
 *
 * A disabled input would look like something to unlock and would invite an
 * attempt to change it; this address is not the recipient's to change. It wraps
 * rather than truncating — an address they cannot finish reading is the one
 * piece of context they must check before choosing a password.
 */
function InvitedAddress({ email }: { email: string | null }) {
  if (!email) return null;

  return (
    <div className="mt-7 flex gap-3.5 rounded-2xl border bg-muted/40 p-4">
      <IconChip
        icon={Lock}
        className="mt-0.5 size-8 rounded-lg bg-foreground/[0.06] text-foreground/70 ring-1 ring-inset ring-foreground/10"
        iconClassName="size-3.5"
      />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Invitation sent to
        </p>
        <p className="mt-1.5 break-all text-[0.9375rem] font-semibold leading-5 text-foreground">
          {email}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          This email will be used to sign in.
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem] text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={cn(FIELD, "mt-2")}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-destructive">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      {message}
    </p>
  );
}
