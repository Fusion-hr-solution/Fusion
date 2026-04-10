"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { ApiError } from "@repo/api";
import { login as apiLogin, persistAuth } from "@repo/auth";
import type { AuthUser, StoredAuth } from "@repo/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  useValidateInvite,
  useAcceptInvite,
  type AcceptInvitePayload,
} from "./use-invite";
import {
  MailIcon,
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

export function InviteAcceptanceForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

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

      // 4. Redirect to the authenticated app
      router.push("/");
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

  if (isValidating) {
    return (
      <InviteShell>
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Spinner className="size-8 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Verifying your invitation…
            </p>
          </CardContent>
        </Card>
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
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 border border-amber-200">
            <MailIcon className="size-3.5" />
            Administrator Invite
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            You&apos;ve been invited to administer{" "}
            <span className="bg-yellow-200 px-1 py-0.5 font-bold">
              {invite.tenantName}
            </span>{" "}
            in Fusion.
          </h1>
          <p className="text-sm text-muted-foreground">
            Access the executive console to manage platform operations, review
            system status, and configure organizational parameters.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Work Email (read-only) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Work Email
              </Label>
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
              <div className="space-y-2">
                <Label
                  htmlFor="firstName"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  First Name
                </Label>
                <Input
                  id="firstName"
                  placeholder="Jane"
                  {...register("firstName")}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="lastName"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Last Name
                </Label>
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
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Create Password
                </Label>
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
              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Confirm Password
                </Label>
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
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Security Requirements
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {serverErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full bg-yellow-400 text-black font-semibold hover:bg-yellow-500"
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
              By accepting, you agree to the Executive Console{" "}
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar — matches Core's authenticated header */}
      <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
        <span className="text-sm font-semibold tracking-widest text-muted-foreground">
          FUSION
        </span>
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-6">
        {children}
      </main>
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
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
