"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ApiError } from "@repo/api";
import { login as apiLogin, persistAuth } from "@repo/auth";
import type { AuthUser, StoredAuth } from "@repo/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

// ---------------------------------------------------------------------------
// Password requirements — must match backend ASP.NET Identity configuration
// ---------------------------------------------------------------------------

interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "8+ characters", test: (v) => v.length >= 8 },
  {
    label: "Upper and lower case",
    test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  { label: "Number", test: (v) => /\d/.test(v) },
  { label: "Symbol", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------

interface AcceptFormValues {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

interface AccountReadyState {
  destination: string;
  email: string;
  signInHref: string;
}

function buildSignInHref(destination: string) {
  const nextPath = destination === "/" ? "/core" : `/core${destination}`;
  return `/auth/signin?next=${encodeURIComponent(nextPath)}`;
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

  const [accountReadyState, setAccountReadyState] =
    useState<AccountReadyState | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isAutoLoginning, setIsAutoLoginning] = useState(false);

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
  const ruleResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        met: rule.test(passwordValue ?? ""),
      })),
    [passwordValue]
  );
  const allRulesMet = ruleResults.every((r) => r.met);

  // ── Submit handler ──────────────────────────────────────────────

  const onSubmit = async (values: AcceptFormValues) => {
    if (!token || !invite) return;

    setAccountReadyState(null);
    setServerErrors([]);

    let nextAccountReadyState: AccountReadyState | null = null;

    try {
      // 1. Accept the invite (creates user account)
      const acceptedUser = await accept.mutateAsync({
        token,
        request: {
          password: values.password,
          firstName: values.firstName || null,
          lastName: values.lastName || null,
        },
      } satisfies AcceptInvitePayload);

      const destination = resolveInviteAcceptanceDestination({
        roles: acceptedUser.roles,
        employeeId: acceptedUser.employeeId ?? null,
      });

      nextAccountReadyState = {
        destination,
        email: acceptedUser.email,
        signInHref: buildSignInHref(destination),
      };
      setAccountReadyState(nextAccountReadyState);

      // 2. Auto-login with the credentials just created
      setIsAutoLoginning(true);
      const authResponse = await apiLogin({
        email: acceptedUser.email,
        password: values.password,
      });

      // 3. Persist session (localStorage + cookie)
      const user: AuthUser = {
        userId: authResponse.userId,
        employeeId: authResponse.employeeId ?? null,
        email: authResponse.email,
        fullName: authResponse.fullName,
        roles: authResponse.roles,
      };
      persistAuth({
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        accessTokenExpiration: authResponse.accessTokenExpiration,
        user,
      } satisfies StoredAuth);

      // 4. Redirect to the role-scoped app entry.
      router.push(destination);
    } catch (err) {
      setIsAutoLoginning(false);

      if (err instanceof ApiError) {
        setServerErrors(
          err.errors.length > 0
            ? err.errors
            : [
                nextAccountReadyState
                  ? "Your account is ready. Sign in to continue."
                  : "Something went wrong. Please try again.",
              ]
        );
      } else {
        setServerErrors([
          nextAccountReadyState
            ? "Your account is ready. Sign in to continue."
            : "An unexpected error occurred. Please try again.",
        ]);
      }
    }
  };

  const isSubmitting = accept.isLoading || isAutoLoginning;
  const isInviteLoading =
    !!token && (isValidating || (!invite && !validateError));

  // ── Missing token ───────────────────────────────────────────────

  if (!token) {
    return (
      <InviteShell>
        <StateCard
          icon={<AlertTriangleIcon className="size-10 text-muted-foreground" />}
          title="Invalid invite link"
          description="Open the invite link from your email and try again."
        />
      </InviteShell>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────

  if (isInviteLoading) {
    return (
      <InviteShell>
        <InviteAcceptanceSkeleton />
      </InviteShell>
    );
  }

  // ── Validation error ────────────────────────────────────────────

  if (validateError || !invite) {
    const is404 =
      validateError instanceof ApiError && validateError.status === 404;
    return (
      <InviteShell>
        <StateCard
          icon={<AlertTriangleIcon className="size-10 text-muted-foreground" />}
          title={is404 ? "Invite not found" : "Could not verify invite"}
          description={
            is404
              ? "Ask your administrator for a new link."
              : "Try again in a moment."
          }
        />
      </InviteShell>
    );
  }

  // ── Expired invite ──────────────────────────────────────────────

  if (invite.isExpired) {
    return (
      <InviteShell>
        <StateCard
          icon={<ClockIcon className="size-10 text-muted-foreground" />}
          title="Invite expired"
          description="Ask your administrator for a new link."
        />
      </InviteShell>
    );
  }

  // ── Already used ────────────────────────────────────────────────

  if (invite.isUsed) {
    return (
      <InviteShell>
        <StateCard
          icon={<CheckCircle2Icon className="size-10 text-green-600" />}
          title="Invite already accepted"
          description="Sign in with your account."
          action={
            <a href={buildSignInHref("/")}>
              <Button>Sign in</Button>
            </a>
          }
        />
      </InviteShell>
    );
  }

  if (accountReadyState) {
    return (
      <InviteShell>
        <StateCard
          icon={<CheckCircle2Icon className="size-10 text-green-600" />}
          title={isAutoLoginning ? "Account ready" : "Sign in to continue"}
          description={
            isAutoLoginning
              ? `Signing in as ${accountReadyState.email}...`
              : `Your account for ${invite.tenantName} is ready.`
          }
          action={
            !isAutoLoginning ? (
              <a href={accountReadyState.signInHref}>
                <Button>Sign in</Button>
              </a>
            ) : null
          }
        >
          {serverErrors.length > 0 ? (
            <Alert variant="destructive" className="text-left">
              <AlertDescription>
                {serverErrors.map((err, index) => (
                  <p key={index}>{err}</p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}
        </StateCard>
      </InviteShell>
    );
  }

  // ── Valid invite — show acceptance form ─────────────────────────

  return (
    <InviteShell>
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <CardTitle>
            Join{" "}
            <span className="bg-yellow-200 px-1 py-0.5">
              {invite.tenantName}
            </span>
          </CardTitle>
          <CardDescription>
            Create your account and continue to Core.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
            {/* Work Email (read-only) */}
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                value={invite.email}
                readOnly
                disabled
                className="bg-muted/50"
              />
            </div>

            {/* Name fields */}
            <div className="grid gap-3 sm:grid-cols-2">
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

            {/* Password fields */}
            <div className="grid gap-3 sm:grid-cols-2">
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
            {passwordValue ? (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">Password needs:</p>
                <div className="grid gap-2 sm:grid-cols-2">
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
            ) : null}

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
                  {serverErrors.map((err, i) => (
                    <p key={i}>{err}</p>
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
                  {isAutoLoginning
                    ? "Signing you in..."
                    : "Creating account..."}
                </>
              ) : (
                <>
                  Create account
                  <ArrowRightIcon className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </InviteShell>
  );
}

// ---------------------------------------------------------------------------
// Shell wrapper — public invite page layout aligned with Core design system
// ---------------------------------------------------------------------------

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error / status state card
// ---------------------------------------------------------------------------

function StateCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-lg">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        {icon}
        <div className="grid gap-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        </div>
        {children}
        {action}
      </CardContent>
    </Card>
  );
}

function InviteAcceptanceSkeleton() {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}
