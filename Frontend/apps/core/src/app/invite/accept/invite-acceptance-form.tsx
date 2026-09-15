"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, type AccountPasswordRequirementsDto } from "@repo/api";
import { login as apiLogin, persistAuth } from "@repo/auth";
import type { AuthUser, StoredAuth } from "@repo/auth";
import {
  Alert,
  AlertDescription,
  Button,
  Field,
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
  type PasswordCheck,
} from "@repo/ds/shell";
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
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useValidateInvite,
  useAcceptInvite,
  type AcceptInvitePayload,
} from "./use-invite";
import { resolveInviteAcceptanceDestination } from "./invite-acceptance-routing";

// ---------------------------------------------------------------------------
// Password requirements → checkable state
// ---------------------------------------------------------------------------

/**
 * The service's password policy as checkable rows the recipient can watch while
 * typing, in the shared field's shape. The service remains the authority; these
 * only mirror it so the outstanding rule is visible before submitting.
 */
function passwordChecks(
  password: string,
  requirements: AccountPasswordRequirementsDto | null | undefined
): PasswordCheck[] {
  if (!requirements) return [];

  const checks: PasswordCheck[] = [
    {
      label: `${requirements.minimumLength} characters or more`,
      satisfied: password.length >= requirements.minimumLength,
    },
  ];
  if (requirements.requiresUppercase) {
    checks.push({
      label: "An uppercase letter",
      satisfied: /[A-Z]/.test(password),
    });
  }
  if (requirements.requiresLowercase) {
    checks.push({
      label: "A lowercase letter",
      satisfied: /[a-z]/.test(password),
    });
  }
  if (requirements.requiresDigit) {
    checks.push({ label: "A number", satisfied: /[0-9]/.test(password) });
  }
  if (requirements.requiresSymbol) {
    checks.push({ label: "A symbol", satisfied: /[^a-zA-Z0-9]/.test(password) });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Terminal states — the stopping points that share one card composition
// ---------------------------------------------------------------------------

interface TerminalDescriptor {
  variant: "resolved" | "error";
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

const INVALID_LINK: TerminalDescriptor = {
  variant: "error",
  icon: TriangleAlert,
  title: "This invitation link does not work",
  detail: "Open the invitation link from your email and try again.",
};

const EXPIRED: TerminalDescriptor = {
  variant: "error",
  icon: Clock,
  title: "This invitation has expired",
  detail: "Ask your administrator for a new invitation link.",
};

const REVOKED: TerminalDescriptor = {
  variant: "error",
  icon: Ban,
  title: "This invitation was cancelled",
  detail:
    "This link is no longer valid. Ask your administrator for a new invitation link.",
};

const ALREADY_USED: TerminalDescriptor = {
  variant: "resolved",
  icon: CircleCheck,
  title: "This invitation has already been used",
  detail: "Sign in with your account to continue.",
  action: { label: "Sign in", href: "/auth/signin" },
};

const VERIFY_FAILED: TerminalDescriptor = {
  variant: "error",
  icon: TriangleAlert,
  title: "We couldn't verify this invitation",
  detail:
    "Try again in a moment. If the problem continues, contact your administrator.",
};

function hasErrorMessage(error: ApiError, fragment: string): boolean {
  return error.errors.some((message) =>
    message.toLowerCase().includes(fragment.toLowerCase())
  );
}

/** Maps a validation failure to the stopping point it represents. */
function validationTerminal(error: unknown): TerminalDescriptor | null {
  if (!error) return null;

  if (!(error instanceof ApiError)) {
    return {
      ...VERIFY_FAILED,
      detail: "Check your connection and try again.",
    };
  }

  if (error.status === 404) {
    return {
      ...INVALID_LINK,
      detail: "Ask your administrator for a new invitation link.",
    };
  }
  if (error.status === 410 && hasErrorMessage(error, "used")) return ALREADY_USED;
  if (error.status === 410 && hasErrorMessage(error, "expired")) return EXPIRED;
  if (error.status === 410 && hasErrorMessage(error, "revoked")) return REVOKED;
  if (error.status >= 500) return VERIFY_FAILED;

  return {
    ...VERIFY_FAILED,
    detail: "Refresh the page or try again in a moment.",
  };
}

/** Submit-time failures the recipient sees inline, keeping their form intact. */
function submitErrorMessages(
  error: unknown,
  step: "accept" | "sign-in"
): string[] {
  if (!(error instanceof ApiError)) {
    return [
      "We couldn't complete your request. Check your connection and try again.",
    ];
  }

  if (step === "sign-in") {
    return [
      error.status === 401 || error.status === 403
        ? "Your account was created, but automatic sign-in failed. Sign in with your new account to continue."
        : "Your account was created, but we couldn't finish signing you in. Try signing in to continue.",
    ];
  }

  if (error.status === 410 && hasErrorMessage(error, "used")) {
    return [
      "This invitation has already been used. Sign in with your account to continue.",
    ];
  }
  if (error.status === 410 && hasErrorMessage(error, "expired")) {
    return [
      "This invitation has expired. Ask your administrator for a new invitation link.",
    ];
  }
  if (error.status === 410 && hasErrorMessage(error, "revoked")) {
    return [
      "This invitation was cancelled. Ask your administrator for a new invitation link.",
    ];
  }
  if (
    error.status === 400 &&
    hasErrorMessage(error, "email is already registered")
  ) {
    return [
      "This email already has an account. Sign in instead, or ask your administrator for a fresh invitation if needed.",
    ];
  }
  // The account or the employee record was claimed since this invitation was
  // issued. Recoverable only through an administrator, never by creating a
  // duplicate here.
  if (error.status === 409) {
    return [
      "This invitation can no longer be completed on its own. Your administrator needs to review workforce access before you can activate.",
    ];
  }
  if (error.errors.length > 0 && error.status < 500) {
    return error.errors;
  }

  return [
    "We couldn't finish setting up your account. Try again in a moment or contact your administrator.",
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FormValues {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

export function InviteAcceptanceForm({ token }: { token: string | null }) {
  const {
    data: invite,
    isLoading: isValidating,
    error: validateError,
  } = useValidateInvite(token);

  const isInviteLoading = !!token && (isValidating || (!invite && !validateError));

  if (!token) {
    return <TerminalScreen descriptor={INVALID_LINK} />;
  }

  if (isInviteLoading) {
    return <InvitationTransactionLoading />;
  }

  const validationTerminalState = validationTerminal(validateError);
  if (validationTerminalState) {
    return <TerminalScreen descriptor={validationTerminalState} />;
  }

  if (!invite) {
    return (
      <TerminalScreen
        descriptor={{
          ...VERIFY_FAILED,
          detail: "Refresh the page and try again.",
        }}
      />
    );
  }

  if (invite.isExpired) {
    return <TerminalScreen descriptor={EXPIRED} />;
  }

  if (invite.isUsed) {
    return <TerminalScreen descriptor={ALREADY_USED} />;
  }

  return <AcceptanceForm token={token} invite={invite} />;
}

function TerminalScreen({ descriptor }: { descriptor: TerminalDescriptor }) {
  return (
    <InvitationTransactionTerminalFrame>
      <InvitationTerminalCard
        variant={descriptor.variant}
        icon={descriptor.icon}
        title={descriptor.title}
        detail={descriptor.detail}
        action={descriptor.action}
      />
    </InvitationTransactionTerminalFrame>
  );
}

// ---------------------------------------------------------------------------
// The acceptance form — a valid, unclaimed invitation
// ---------------------------------------------------------------------------

type Progress = "idle" | "creating" | "signing-in" | "opening";

function AcceptanceForm({
  token,
  invite,
}: {
  token: string;
  // Narrowed to the validated invite shape the form needs.
  invite: NonNullable<ReturnType<typeof useValidateInvite>["data"]>;
}) {
  const router = useRouter();
  const accept = useAcceptInvite();

  // A workforce recipient's name is owned by their employee record, so they set
  // a password only. Administrator invitations create a new account and collect
  // the name here.
  const isWorkforce = invite.role === "Employee" || invite.role === "Manager";
  const accessLabel = invite.role === "Manager" ? "Manager" : "Employee";
  const tenantName = invite.tenantName || "your organization";

  const [form, setForm] = useState<FormValues>(() => ({
    firstName: invite.firstName ?? "",
    lastName: invite.lastName ?? "",
    password: "",
    confirmPassword: "",
  }));
  const [revealConfirm, setRevealConfirm] = useState(false);
  const [progress, setProgress] = useState<Progress>("idle");
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const update = useCallback(
    (field: keyof FormValues, value: string) =>
      setForm((current) => ({ ...current, [field]: value })),
    []
  );

  const checks = useMemo(
    () => passwordChecks(form.password, invite.passwordRequirements),
    [form.password, invite.passwordRequirements]
  );
  const passwordsMatch =
    Boolean(form.password) && form.confirmPassword === form.password;

  const nameReady =
    isWorkforce ||
    (form.firstName.trim().length > 0 && form.lastName.trim().length > 0);
  const canSubmit =
    nameReady &&
    form.password.length > 0 &&
    checks.length > 0 &&
    checks.every((check) => check.satisfied) &&
    passwordsMatch;

  const pending = progress !== "idle";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !canSubmit) return;

    setServerErrors([]);
    setProgress("creating");
    let step: "accept" | "sign-in" = "accept";

    try {
      // 1. Accept the invitation (creates the user account). Workforce recipients
      //    keep the canonical names the invitation carried.
      await accept.mutateAsync({
        token,
        request: {
          password: form.password,
          firstName: isWorkforce
            ? invite.firstName ?? null
            : form.firstName.trim() || invite.firstName || null,
          lastName: isWorkforce
            ? invite.lastName ?? null
            : form.lastName.trim() || invite.lastName || null,
        },
      } satisfies AcceptInvitePayload);

      // 2. Sign in with the credentials just created.
      setProgress("signing-in");
      step = "sign-in";
      const authResponse = await apiLogin({
        email: invite.email,
        password: form.password,
      });

      // 3. Persist the session (localStorage + cookie).
      const user: AuthUser = {
        userId: authResponse.userId,
        tenantId: authResponse.tenantId ?? null,
        tenantMembershipId: authResponse.tenantMembershipId ?? null,
        moduleEntitlements: authResponse.moduleEntitlements ?? [],
        employeeId: authResponse.employeeId ?? null,
        email: authResponse.email,
        fullName: authResponse.fullName,
        roles: authResponse.roles,
        accessProfiles: authResponse.accessProfiles ?? [],
        effectivePermissions: authResponse.effectivePermissions ?? [],
      };
      persistAuth({
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        accessTokenExpiration: authResponse.accessTokenExpiration,
        user,
      } satisfies StoredAuth);

      // Let the shared auth provider consume its same-tab storage event before
      // resolving a protected route, so the first authenticated render does not
      // race the session that was just issued.
      setProgress("opening");
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      router.replace(resolveInviteAcceptanceDestination(user));
    } catch (err) {
      setProgress("idle");
      setServerErrors(submitErrorMessages(err, step));
    }
  }

  return (
    <InvitationTransactionFrame
      context={
        isWorkforce ? (
          <InvitationContextPanel
            eyebrow="Your access"
            heading={tenantName}
            lead="Activate the account connected to your employee record. Your organization owns the identity and work details shown in Fusion."
            rows={[
              { icon: Building2, label: "Organization", value: tenantName },
              { icon: Users, label: "Access", value: accessLabel },
              { icon: Mail, label: "Account email", value: invite.email },
            ]}
            securityNote="This invitation is secure and tied to your work email address. Only you can use this link."
            footerLabel="People work together"
          />
        ) : (
          <InvitationContextPanel
            eyebrow="You're invited"
            heading={`Join ${tenantName}`}
            lead={`You've been invited to set up your Fusion account and get started with ${tenantName}.`}
            rows={[
              { icon: Building2, label: "Organization", value: tenantName },
              { icon: Users, label: "Assigned role", value: "Administrator" },
              { icon: Mail, label: "Invitation sent to", value: invite.email },
            ]}
            securityNote="This invitation is secure and tied to the invited email address. Only the intended recipient can use this link."
            footerLabel="People work together"
          />
        )
      }
    >
      <form onSubmit={submit} noValidate>
        <header>
          <h2 className="font-heading text-[1.875rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
            {isWorkforce ? "Activate your account" : "Set up your account"}
          </h2>
          <p className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">
            {isWorkforce
              ? `${tenantName} has set up your Fusion access. Choose a password to activate your account.`
              : `Accept your invitation from ${tenantName} to create your Fusion account.`}
          </p>
        </header>

        {serverErrors.length > 0 ? (
          <Alert
            variant="destructive"
            className="mt-6 border-destructive/30 bg-destructive/10"
          >
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-destructive">
              {[...new Set(serverErrors)].map((message) => (
                <p key={message}>{message}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="mt-6 gap-4">
          {!isWorkforce ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="firstName"
                label="First name"
                autoComplete="given-name"
                value={form.firstName}
                disabled={pending}
                onChange={(value) => update("firstName", value)}
              />
              <TextField
                id="lastName"
                label="Last name"
                autoComplete="family-name"
                value={form.lastName}
                disabled={pending}
                onChange={(value) => update("lastName", value)}
              />
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="workEmail">
              {isWorkforce ? "Work email" : "Invitation email"}
            </FieldLabel>
            {/* The invited address as a fact, not a field to change: the recipient
                confirms the invitation is theirs and sees the address they will
                sign in with. */}
            <InputGroup className="h-11 bg-muted/40 dark:bg-muted/40">
              <InputGroupInput
                id="workEmail"
                type="email"
                value={invite.email}
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

          <PasswordStrengthField
            id="password"
            label={isWorkforce ? "Create password" : "Create password"}
            value={form.password}
            checks={checks}
            onChange={(value) => update("password", value)}
          />

          <Field>
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
                disabled={pending}
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
                  <X
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground/60"
                  />
                )}
                {passwordsMatch
                  ? "Passwords match"
                  : "Passwords do not match yet"}
              </p>
            ) : null}
          </Field>

          <Button
            type="submit"
            size="lg"
            disabled={pending || !canSubmit}
            aria-busy={pending}
            className="relative h-12 w-full text-[0.9375rem] font-semibold"
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner aria-hidden="true" />
                {progress === "signing-in"
                  ? "Signing you in…"
                  : progress === "opening"
                    ? "Opening Fusion…"
                    : isWorkforce
                      ? "Activating your account…"
                      : "Creating your account…"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {isWorkforce ? "Activate account" : "Set up account"}
                <ArrowRight />
              </span>
            )}
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
    </InvitationTransactionFrame>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        className="h-11"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
