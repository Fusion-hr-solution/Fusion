"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ApiError, type AccountPasswordRequirementsDto } from "@repo/api";
import { login as apiLogin, persistAuth } from "@repo/auth";
import type { AuthUser, StoredAuth } from "@repo/auth";
import {
  InvitationTransactionFrame,
  InvitationTransactionLoading,
  InvitationTransactionTerminalFrame,
  InvitationWordmark,
} from "@repo/ds/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useValidateInvite,
  useAcceptInvite,
  type AcceptInvitePayload,
} from "./use-invite";
import { resolveInviteAcceptanceDestination } from "./invite-acceptance-routing";
import {
  CheckCircle2Icon,
  CircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  ArrowRightIcon,
} from "lucide-react";

interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

function passwordRules(
  requirements: AccountPasswordRequirementsDto
): PasswordRule[] {
  const rules: PasswordRule[] = [
    {
      label: `${requirements.minimumLength}+ characters`,
      test: (value) => value.length >= requirements.minimumLength,
    },
  ];
  if (requirements.requiresLowercase && requirements.requiresUppercase) {
    rules.push({
      label: "Upper and lower case",
      test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value),
    });
  } else if (requirements.requiresLowercase) {
    rules.push({
      label: "Lowercase letter",
      test: (value) => /[a-z]/.test(value),
    });
  } else if (requirements.requiresUppercase) {
    rules.push({
      label: "Uppercase letter",
      test: (value) => /[A-Z]/.test(value),
    });
  }
  if (requirements.requiresDigit) {
    rules.push({ label: "Number", test: (value) => /\d/.test(value) });
  }
  if (requirements.requiresSymbol) {
    rules.push({
      label: "Symbol",
      test: (value) => /[^a-zA-Z0-9]/.test(value),
    });
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------

interface AcceptFormValues {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

interface InviteErrorStateConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function hasErrorMessage(error: ApiError, fragment: string): boolean {
  return error.errors.some((message) =>
    message.toLowerCase().includes(fragment.toLowerCase())
  );
}

function getInviteValidationErrorState(
  error: unknown
): InviteErrorStateConfig | null {
  if (!error) {
    return null;
  }

  if (!(error instanceof ApiError)) {
    return {
      icon: <AlertTriangleIcon className="size-10 text-muted-foreground" />,
      title: "Could not verify invite",
      description: "Check your connection and try again.",
    };
  }

  if (error.status === 404) {
    return {
      icon: <AlertTriangleIcon className="size-10 text-muted-foreground" />,
      title: "Invite not found",
      description: "Ask your administrator for a new invite link.",
    };
  }

  if (error.status === 410 && hasErrorMessage(error, "used")) {
    return {
      icon: <CheckCircle2Icon className="size-10 text-green-600" />,
      title: "Invite already accepted",
      description: "Sign in with your account to continue.",
      action: (
        <Button asChild>
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      ),
    };
  }

  if (error.status === 410 && hasErrorMessage(error, "expired")) {
    return {
      icon: <ClockIcon className="size-10 text-muted-foreground" />,
      title: "Invite expired",
      description: "Ask your administrator for a new invite link.",
    };
  }

  if (error.status === 410 && hasErrorMessage(error, "revoked")) {
    return {
      icon: <AlertTriangleIcon className="size-10 text-muted-foreground" />,
      title: "Invite cancelled",
      description:
        "This invite is no longer valid. Ask your administrator for a new invite link.",
    };
  }

  if (error.status >= 500) {
    return {
      icon: <AlertTriangleIcon className="size-10 text-muted-foreground" />,
      title: "Could not verify invite",
      description:
        "Try again in a moment. If the problem continues, contact your administrator.",
    };
  }

  return {
    icon: <AlertTriangleIcon className="size-10 text-muted-foreground" />,
    title: "Could not verify invite",
    description: "Refresh the page or try again in a moment.",
  };
}

function getInviteSubmitErrorMessages(
  error: unknown,
  step: "accept" | "sign-in"
): string[] {
  if (!(error instanceof ApiError)) {
    return [
      "We couldn't complete your request. Check your connection and try again.",
    ];
  }

  if (step === "sign-in") {
    const messages = [
      error.status === 401 || error.status === 403
        ? "Your account was created, but automatic sign-in failed. Sign in with your new account to continue."
        : "Your account was created, but we couldn't finish signing you in. Try signing in to continue.",
    ];

    return messages;
  }

  if (error.status === 410 && hasErrorMessage(error, "used")) {
    return [
      "This invite has already been accepted. Sign in with your account to continue.",
    ];
  }

  if (error.status === 410 && hasErrorMessage(error, "expired")) {
    return [
      "This invite has expired. Ask your administrator for a new invite link.",
    ];
  }

  if (error.status === 410 && hasErrorMessage(error, "revoked")) {
    return [
      "This invite was cancelled. Ask your administrator for a new invite link.",
    ];
  }

  if (
    error.status === 400 &&
    hasErrorMessage(error, "email is already registered")
  ) {
    return [
      "This email already has an account. Sign in instead, or ask your administrator for a fresh invite if needed.",
    ];
  }

  // The account or the employee record was claimed since this invitation was issued.
  // It is recoverable only through an administrator, never by creating a duplicate here.
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

export function InviteAcceptanceForm({ token }: { token: string | null }) {
  const router = useRouter();

  const {
    data: invite,
    isLoading: isValidating,
    error: validateError,
  } = useValidateInvite(token);

  const accept = useAcceptInvite();

  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<
    "idle" | "creating" | "signing-in" | "opening"
  >("idle");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AcceptFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
    values: invite
      ? {
          firstName: invite.firstName ?? "",
          lastName: invite.lastName ?? "",
          password: "",
          confirmPassword: "",
        }
      : undefined,
  });

  const passwordValue = watch("password");
  const serverPasswordRules = useMemo(
    () =>
      invite?.passwordRequirements
        ? passwordRules(invite.passwordRequirements)
        : [],
    [invite?.passwordRequirements]
  );
  const ruleResults = useMemo(
    () =>
      serverPasswordRules.map((rule) => ({
        ...rule,
        met: rule.test(passwordValue ?? ""),
      })),
    [passwordValue, serverPasswordRules]
  );
  const allRulesMet =
    ruleResults.length > 0 && ruleResults.every((rule) => rule.met);

  // ── Submit handler ──────────────────────────────────────────────

  const onSubmit = async (values: AcceptFormValues) => {
    if (!token || !invite) return;

    setServerErrors([]);
    setProgress("creating");
    let submitStep: "accept" | "sign-in" = "accept";

    try {
      // 1. Accept the invite (creates user account)
      await accept.mutateAsync({
        token,
        request: {
          password: values.password,
          // Workforce recipients don't re-enter their name; the canonical names carried
          // by the invitation are used, so a hidden/unregistered field never blanks them.
          firstName: values.firstName || invite.firstName || null,
          lastName: values.lastName || invite.lastName || null,
        },
      } satisfies AcceptInvitePayload);

      // 2. Auto-login with the credentials just created
      setProgress("signing-in");
      submitStep = "sign-in";
      const authResponse = await apiLogin({
        email: invite.email,
        password: values.password,
      });

      // 3. Persist session (localStorage + cookie)
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

      // Allow the shared auth provider to consume its same-tab storage event before
      // resolving a protected route. This keeps the first authenticated render from
      // racing the session that was just issued.
      setProgress("opening");
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      router.replace(resolveInviteAcceptanceDestination(user));
    } catch (err) {
      setProgress("idle");
      setServerErrors(getInviteSubmitErrorMessages(err, submitStep));
    }
  };

  const isSubmitting = accept.isLoading || progress !== "idle";
  const isInviteLoading =
    !!token && (isValidating || (!invite && !validateError));

  // ── Missing token ───────────────────────────────────────────────

  if (!token) {
    return (
      <InviteShell>
        <ErrorState
          icon={<AlertTriangleIcon className="size-10 text-muted-foreground" />}
          title="Invalid invite link"
          description="Open the invite link from your email and try again."
        />
      </InviteShell>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────

  if (isInviteLoading) {
    return <InvitationTransactionLoading />;
  }

  // ── Validation error ────────────────────────────────────────────

  const validationErrorState = getInviteValidationErrorState(validateError);

  if (validationErrorState) {
    return (
      <InviteShell>
        <ErrorState
          icon={validationErrorState.icon}
          title={validationErrorState.title}
          description={validationErrorState.description}
          action={validationErrorState.action}
        />
      </InviteShell>
    );
  }

  if (!invite) {
    return (
      <InviteShell>
        <ErrorState
          icon={<AlertTriangleIcon className="size-10 text-muted-foreground" />}
          title="Could not verify invite"
          description="Refresh the page and try again."
        />
      </InviteShell>
    );
  }

  // ── Expired invite ──────────────────────────────────────────────

  if (invite.isExpired) {
    return (
      <InviteShell>
        <ErrorState
          icon={<ClockIcon className="size-10 text-muted-foreground" />}
          title="Invite expired"
          description="Ask your administrator for a new invite link."
        />
      </InviteShell>
    );
  }

  // ── Already used ────────────────────────────────────────────────

  if (invite.isUsed) {
    return (
      <InviteShell>
        <ErrorState
          icon={<CheckCircle2Icon className="size-10 text-green-600" />}
          title="Invite already accepted"
          description="Sign in with your account to continue."
          action={
            <Button asChild>
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          }
        />
      </InviteShell>
    );
  }

  // ── Valid invite — show acceptance form ─────────────────────────

  // The recipient page is shared with the three administrator purposes. For a
  // workforce invitation (Employee/Manager role) the canonical Employee already owns
  // the name, so the recipient only sets a password — the locked Workforce UX. The
  // administrator purposes keep their existing "Join {tenant}" account-creation copy.
  const isWorkforce = invite.role === "Employee" || invite.role === "Manager";
  const accessLabel = invite.role === "Manager" ? "Manager" : "Employee";

  return (
    <InvitationTransactionFrame
      context={
        <InviteContext
          tenantName={invite.tenantName}
          email={invite.email}
          accessLabel={accessLabel}
          isWorkforce={isWorkforce}
        />
      }
    >
      <div className="w-full">
        <header className="mb-8">
          {isWorkforce ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Activate your Fusion account
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {invite.tenantName} has set up your Fusion access. Choose a
                password to activate your account.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Join {invite.tenantName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Create your account to continue.
              </p>
            </>
          )}
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
          <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-y py-4 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate font-medium text-foreground">
              {invite.email}
            </dd>
            {isWorkforce ? (
              <>
                <dt className="text-muted-foreground">Access</dt>
                <dd className="font-medium text-foreground">{accessLabel}</dd>
              </>
            ) : null}
          </dl>

          {!isWorkforce ? (
            /* Name fields — administrator account creation only */
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Jane"
                  {...register("firstName")}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  {...register("lastName")}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : null}

          {/* Password fields */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("password", {
                  required: "Password is required",
                  validate: () =>
                    allRulesMet || "Password does not meet all requirements",
                })}
                aria-invalid={!!errors.password}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (value) =>
                    value === passwordValue || "Passwords do not match",
                })}
                aria-invalid={!!errors.confirmPassword}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password requirements checklist */}
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">Password needs:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ruleResults.map((rule) => (
                <div
                  key={rule.label}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {rule.met ? (
                    <CheckCircle2Icon className="size-3.5 text-green-600" />
                  ) : (
                    <CircleIcon className="size-3.5 text-muted-foreground/50" />
                  )}
                  <span
                    className={
                      rule.met ? "text-green-700" : "text-muted-foreground"
                    }
                  >
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form-level validation errors */}
          {(errors.password || errors.confirmPassword) && (
            <p className="text-sm text-destructive">
              {errors.password?.message || errors.confirmPassword?.message}
            </p>
          )}

          {/* Server errors */}
          {serverErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                {[...new Set(serverErrors)].map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2" />
                {progress === "signing-in"
                  ? "Signing you in..."
                  : progress === "opening"
                    ? "Opening Fusion..."
                    : "Creating your account..."}
              </>
            ) : (
              <>
                {isWorkforce ? "Activate account" : "Accept and continue"}
                <ArrowRightIcon className="ml-2 size-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </InvitationTransactionFrame>
  );
}

// ---------------------------------------------------------------------------
// Shell wrapper — public invite page layout aligned with Core design system
// ---------------------------------------------------------------------------

function InviteContext({
  tenantName,
  email,
  accessLabel,
  isWorkforce,
}: {
  tenantName: string;
  email: string;
  accessLabel: string;
  isWorkforce: boolean;
}) {
  const initials = tenantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="mx-auto flex h-full max-w-[34rem] flex-col lg:max-w-[33rem]">
      <InvitationWordmark />
      <div className="mt-12 grid size-12 place-items-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold lg:hidden">
        {initials}
      </div>
      <h1 className="mt-6 lg:mt-16">
        <span className="block text-lg font-normal text-white/58 lg:text-xl">
          {isWorkforce ? "Your place in" : "You have been invited to"}
        </span>
        <span className="mt-2 block break-words text-[2rem] font-semibold leading-[1.08] tracking-[-0.025em] lg:mt-3 lg:text-[3rem]">
          {tenantName}
        </span>
      </h1>
      <p className="mt-6 max-w-[46ch] text-sm leading-7 text-white/58 lg:text-base">
        {isWorkforce
          ? "Activate the account connected to your employee record. Your organization owns the identity and work details shown in Fusion."
          : "Create your account to accept the invitation and continue into the workspace."}
      </p>
      <div
        aria-hidden="true"
        className="my-14 hidden flex-1 place-items-center lg:grid"
      >
        <div className="grid size-52 place-items-center rounded-[2.5rem] border border-white/[0.08]">
          <div className="grid size-32 place-items-center rounded-[2rem] border border-white/[0.12]">
            <span className="grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/5 text-xl font-semibold">
              {initials}
            </span>
          </div>
        </div>
      </div>
      <dl className="mt-12 grid gap-6 border-t border-white/15 pt-7 text-sm sm:grid-cols-2 lg:mt-0">
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-white/58">
            Access granted
          </dt>
          <dd className="mt-2 font-medium">{accessLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-white/58">
            Account email
          </dt>
          <dd className="mt-2 truncate font-medium">{email}</dd>
        </div>
      </dl>
    </div>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return <InvitationTransactionTerminalFrame>{children}</InvitationTransactionTerminalFrame>;
}

// ---------------------------------------------------------------------------
// Error / status state card
// ---------------------------------------------------------------------------

function ErrorState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      {icon}
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}
