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
  ShieldCheckIcon,
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
  { label: "10+ characters", test: (v) => v.length >= 10 },
  {
    label: "Upper & lower case",
    test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  { label: "Special character", test: (v) => /[^a-zA-Z0-9]/.test(v) },
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

    setServerErrors([]);

    try {
      // 1. Accept the invite (creates user account)
      await accept.mutateAsync({
        token,
        request: {
          password: values.password,
          firstName: values.firstName || null,
          lastName: values.lastName || null,
        },
      } satisfies AcceptInvitePayload);

      // 2. Auto-login with the credentials just created
      setIsAutoLoginning(true);
      const authResponse = await apiLogin({
        email: invite.email,
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
      router.push(resolveInviteAcceptanceDestination(user));
    } catch (err) {
      setIsAutoLoginning(false);
      if (err instanceof ApiError) {
        setServerErrors(
          err.errors.length > 0
            ? err.errors
            : ["Something went wrong. Please try again."]
        );
      } else {
        setServerErrors(["An unexpected error occurred. Please try again."]);
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
        <ErrorState
          icon={<AlertTriangleIcon className="size-10 text-muted-foreground" />}
          title="Invalid Invite Link"
          description="This link is missing a valid invitation token. Please check the link from your email and try again."
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
        <ErrorState
          icon={<AlertTriangleIcon className="size-10 text-muted-foreground" />}
          title={is404 ? "Invitation Not Found" : "Unable to Verify Invitation"}
          description={
            is404
              ? "This invitation link is invalid or has been revoked. Please contact your administrator."
              : "We couldn't verify this invitation right now. Please try again later."
          }
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
          title="Invitation Expired"
          description="This invitation has expired. Please contact your administrator to request a new one."
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
          title="Invitation Already Accepted"
          description="This invitation has already been used. You can sign in with your existing credentials."
          action={
            <a href="/auth/signin">
              <Button>Go to Sign In</Button>
            </a>
          }
        />
      </InviteShell>
    );
  }

  // ── Valid invite — show acceptance form ─────────────────────────

  return (
    <InviteShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            Accept invitation for{" "}
            <span className="bg-yellow-200 px-1 py-0.5">
              {invite.tenantName}
            </span>
          </CardTitle>
          <CardDescription>
            Set up your administrator account to manage platform operations and
            configure organizational parameters.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            {/* Work Email (read-only) */}
            <div className="grid gap-2">
              <Label>Work Email</Label>
              <Input
                value={invite.email}
                readOnly
                disabled
                className="bg-muted/50"
              />
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <ShieldCheckIcon className="size-3.5" />
                Verified professional identity
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
              <p className="text-xs text-muted-foreground">
                Security requirements
              </p>
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
                    ? "Signing you in…"
                    : "Creating your account…"}
                </>
              ) : (
                <>
                  Accept Invitation &amp; Continue
                  <ArrowRightIcon className="ml-2 size-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By accepting, you agree to the{" "}
              <a
                href="#"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Service Terms
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Protocol
              </a>
              .
            </p>
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
    <Card className="w-full max-w-lg">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
        {icon}
        <div className="grid gap-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        </div>
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
