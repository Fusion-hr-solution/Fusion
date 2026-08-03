"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label, cn } from "@repo/ui";
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
  type ActivationEntry,
  type ActivationFieldError,
  type ActivationForm,
  type ActivationOutcome,
  errorFor,
  formatExpiry,
  monogramFor,
  passwordChecks,
  scrubbedUrl,
  terminalState,
  validateForm,
} from "../../lib/activation";

const ENDPOINT = "/api/identity/tenant-activation";

/** Where the new administrator lands. Owned by Core, not by this page. */
const SETUP_DESTINATION = "/core/setup";

/**
 * The context panel is ink in both themes.
 *
 * It is the one surface on this page that does not follow the theme: an
 * invitation arrives cold, from an organization the recipient may not yet
 * recognise, and the ink half gives the page a fixed centre of gravity that
 * reads the same whichever theme the recipient's browser asks for. The values
 * are the dark theme's own tuned tokens written as literals, so the panel is not
 * a new palette — it is the palette Fusion already ships, pinned.
 */
const PANEL_SURFACE = "bg-[hsl(240_16%_7%)]";
const PANEL_TEXT = "text-[hsl(240_14%_96%)]";
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
  "h-11 rounded-xl border-input/80 bg-background shadow-sm transition " +
  "hover:border-foreground/30 " +
  "focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-primary " +
  "focus-visible:ring-offset-0 focus-visible:shadow-none " +
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 " +
  "aria-[invalid=true]:ring-destructive/20";

type Phase =
  | { kind: "loading" }
  | { kind: "form"; entry: ActivationEntry }
  | { kind: "terminal"; outcome: ActivationOutcome };

export function ActivateInvitation() {
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
          `${ENDPOINT}?credential=${encodeURIComponent(credential)}`,
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
  }, [credential]);

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
      <FocusedFrame>
        <Terminal outcome={phase.outcome} />
      </FocusedFrame>
    );
  }

  return (
    <SplitFrame
      context={
        phase.kind === "form" ? <TenantContext entry={phase.entry} /> : <ContextSkeleton />
      }
    >
      {phase.kind === "form" ? (
        <AccountForm
          entry={phase.entry}
          credential={credential}
          onTerminal={(outcome) => setPhase({ kind: "terminal", outcome })}
        />
      ) : (
        <FormSkeleton />
      )}
    </SplitFrame>
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
function SplitFrame({
  context,
  children,
}: {
  context: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[44fr_56fr]">
      <div
        className={cn(
          "relative overflow-hidden border-b border-[hsl(240_8%_18%)] px-6 py-12 sm:px-10 lg:border-b-0 lg:border-r lg:py-16",
          PANEL_SURFACE,
          PANEL_TEXT
        )}
      >
        {/* A single warm source top-left, so the panel is lit rather than
            filled. Low enough that the ink stays ink. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(45rem_32rem_at_8%_-8%,hsl(47_100%_50%/0.13),transparent_62%),radial-gradient(38rem_30rem_at_92%_108%,hsl(240_60%_60%/0.10),transparent_60%)]"
        />
        <div className="relative h-full">{context}</div>
      </div>

      {/* In dark mode the canvas is within a few percent of the ink panel, which
          erases the split. The task surface lifts to the card layer so the two
          halves stay distinct in both themes. */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12 dark:bg-[hsl(240_13%_11%)] sm:px-10 lg:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(40rem_28rem_at_50%_-10%,hsl(var(--foreground)/0.045),transparent_65%)]"
        />
        {/* Below `lg` the two halves are stacked, so they share one measure and
            line up down the page. The split narrows the form to a focused
            column. */}
        <div className="relative w-full max-w-[34rem] lg:max-w-[28rem]">{children}</div>
      </div>
    </main>
  );
}

/** The terminal states, which have no second half to show. */
function FocusedFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6 py-12 sm:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(45rem_30rem_at_50%_-12%,hsl(var(--foreground)/0.05),transparent_65%)]"
      />
      {/* Composed as one unit rather than a heading adrift in the middle of an
          empty page: the identity sits directly above the surface carrying the
          state, so the stopping point reads as finished rather than as a page
          that failed to load. */}
      <div className="relative flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[29rem]">
          <Wordmark className="text-foreground" />
          <div className="mt-6 rounded-2xl border bg-background p-7 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-12px_hsl(var(--foreground)/0.14)] sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-[0.8125rem] font-semibold uppercase tracking-[0.24em]",
        className
      )}
    >
      Fusion
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Context panel                                                              */
/* -------------------------------------------------------------------------- */

function TenantContext({ entry }: { entry: ActivationEntry }) {
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
        <span className={cn("block text-lg font-normal lg:text-xl", PANEL_MUTED)}>
          Create administrator access for
        </span>
        <span className="mt-2 block break-words text-[2rem] font-semibold leading-[1.08] tracking-[-0.025em] lg:mt-3 lg:text-[3rem]">
          {tenantName}
        </span>
      </h1>

      <p className={cn("mt-6 max-w-[46ch] text-sm leading-7 lg:text-base", PANEL_MUTED)}>
        You have been invited to become this tenant&apos;s first administrator.
        Create your account to continue.
      </p>

      <TenantSigil tenantName={tenantName} />

      <dl
        className={cn(
          "mt-12 grid gap-6 border-t pt-7 text-sm sm:grid-cols-2 lg:mt-0",
          PANEL_RULE
        )}
      >
        <div>
          <dt className={cn("text-xs uppercase tracking-[0.12em]", PANEL_MUTED)}>
            Access granted
          </dt>
          <dd className="mt-2 font-medium">Administrator</dd>
        </div>
        {expiry ? (
          <div>
            <dt className={cn("text-xs uppercase tracking-[0.12em]", PANEL_MUTED)}>
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
    <div aria-hidden="true" className="my-14 hidden flex-1 place-items-center lg:grid">
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

function Terminal({ outcome }: { outcome: ActivationOutcome }) {
  const state = terminalState(outcome);
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
  onTerminal,
}: {
  entry: ActivationEntry;
  credential: string;
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
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
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
        window.location.assign(SETUP_DESTINATION);
        return;
      }

      const reason = body?.data?.reason as string | undefined;

      if (reason === "invalid_details") {
        const fields = (body?.data?.fieldErrors ?? []) as ActivationFieldError[];
        setErrors(
          fields.length > 0
            ? fields
            : [{ field: "password", message: "This password was not accepted." }]
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
        Create your administrator account
      </h2>

      <InvitedAddress email={entry.invitedEmail} />

      {retryable ? (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm leading-6 text-destructive"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
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
                check.satisfied ? "font-medium text-foreground" : "text-muted-foreground"
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

      {/* Fusion's spinner-only convention. Implemented here rather than imported
          from the shared design system: that package targets the Tailwind v4
          apps, and the shell has not migrated. */}
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
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
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
    <div className="mt-7 flex gap-3.5 rounded-2xl border bg-muted/40 p-4 shadow-sm">
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

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

/** Both halves are shaped like what they resolve into, so the page does not jump. */
function ContextSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-[34rem] flex-col lg:max-w-[33rem]">
      <Wordmark />
      <div className="animate-pulse" aria-hidden="true">
        <div className="mt-12 size-12 rounded-xl bg-white/10 lg:hidden" />
        <div className="mt-6 h-6 w-64 rounded-lg bg-white/[0.07] lg:mt-16 lg:h-7" />
        <div className="mt-3 space-y-3">
          <div className="h-9 w-full rounded-lg bg-white/10 lg:h-12" />
          <div className="h-9 w-2/3 rounded-lg bg-white/10 lg:h-12" />
        </div>
        <div className="mt-7 space-y-2.5">
          <div className="h-4 w-5/6 rounded bg-white/[0.06]" />
          <div className="h-4 w-3/5 rounded bg-white/[0.06]" />
        </div>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="h-8 w-3/4 rounded-lg bg-muted" />
      <div className="mt-7 h-[6.25rem] rounded-2xl bg-muted" />
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div className="h-[4.5rem] rounded-xl bg-muted" />
        <div className="h-[4.5rem] rounded-xl bg-muted" />
      </div>
      <div className="mt-5 h-[4.5rem] rounded-xl bg-muted" />
      <div className="mt-3.5 h-[4.5rem] rounded-xl bg-muted" />
      <div className="mt-5 h-[4.5rem] rounded-xl bg-muted" />
      <div className="mt-8 h-12 rounded-xl bg-muted" />
    </div>
  );
}
