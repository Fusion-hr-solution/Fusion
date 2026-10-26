"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Landmark, Lock, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Label,
} from "@repo/ds";
import { useAuth } from "../auth-context";
import { loadAuth } from "../auth-service";
import type { AuthUser, LoginFailure } from "../types";
import {
  landingRequiresOrganizationReadiness,
  resolvePostSignInDestination,
  sanitizeInternalReturnPath,
  type OrganizationReadinessSignal,
} from "../routing";
import { fetchOrganizationReadySignal } from "../organization-ready-landing";

export interface SignInPageProps {
  /** Called after successful login or when already authenticated. Defaults to callbackUrl/next or "/" */
  onSuccess?: () => void;
  /** @deprecated Self-service registration is disabled; this is retained for API compatibility. */
  signUpUrl?: string;
}

function intendedDestination(searchParams: Pick<URLSearchParams, "get">): string | null {
  return searchParams.get("callbackUrl") ?? searchParams.get("next");
}

/**
 * What a failed sign-in says. Identity answers wrong credentials with a 401 and no code, so that case is the
 * catalogue's line; any other answer reads as the server wrote it in English, and as a generic line in other
 * languages (server text is translated in a later phase).
 */
function failureMessages(
  failure: LoginFailure,
  locale: string,
  t: ReturnType<typeof useTranslations<"auth.signIn">>,
): string[] {
  if (failure.status === 401) return [t("invalidCredentials")];
  if (locale === "en" && failure.messages.length > 0) return failure.messages;
  return [t("failed")];
}

function navigateToRedirectTarget(target: string, mode: "push" | "replace") {
  if (mode === "replace") {
    window.location.replace(target);
  } else {
    window.location.assign(target);
  }
}

export function SignInPage({
  onSuccess,
}: SignInPageProps) {
  const t = useTranslations("auth.signIn");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { login, user, isLoading: authLoading, isAuthenticated } = useAuth();
  const intended = intendedDestination(searchParams);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve the landing for the just-authenticated user. A safe callback decides
  // the destination on its own and needs no readiness read; only the
  // Tenant Administrator foundation fallback consults canonical Organization
  // readiness, which fails closed to Getting Started when it cannot be read.
  const finishSignIn = useCallback(
    async (nextUser: AuthUser | null, mode: "push" | "replace") => {
      if (onSuccess) {
        onSuccess();
        return;
      }

      let organizationReady: OrganizationReadinessSignal;
      if (
        !sanitizeInternalReturnPath(intended) &&
        landingRequiresOrganizationReadiness(nextUser)
      ) {
        organizationReady = await fetchOrganizationReadySignal();
      }

      navigateToRedirectTarget(
        resolvePostSignInDestination({
          intendedDestination: intended,
          user: nextUser,
          organizationReady,
        }) ?? "/",
        mode
      );
    },
    [intended, onSuccess]
  );

  // Redirect an already-authenticated visitor away from the sign-in form.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void finishSignIn(user, "replace");
    }
  }, [authLoading, isAuthenticated, user, finishSignIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      if (result) {
        setErrors(failureMessages(result, locale, t));
      } else {
        await finishSignIn(loadAuth()?.user ?? null, "push");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div lang={locale} className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* Ambient brand glow — quiet, token-driven, never competes with the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <div className="relative w-full max-w-[26rem]">
        <div className="rounded-surface border border-border bg-card px-8 py-9 shadow-overlay">
          <div className="flex flex-col items-center gap-6">
            <Wordmark />

            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="type-page-title text-card-foreground">{t("title")}</h1>
              <p className="type-body text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <FieldGroup>
              {errors.length > 0 && (
                <Alert
                  variant="destructive"
                  className="border-destructive/30 bg-destructive/10"
                >
                  <AlertDescription className="text-destructive">
                    {errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              <Field>
                <FieldLabel htmlFor="email" className="text-card-foreground">
                  {t("email")}
                </FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <Mail />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="password" className="text-card-foreground">
                  {t("password")}
                </FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <Lock />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? t("hideCharacters") : t("showCharacters")
                      }
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="remember-me"
                  className="flex items-center gap-2 font-normal text-muted-foreground"
                >
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(value) => setRememberMe(value === true)}
                  />
                  {t("rememberMe")}
                </Label>
                <button
                  type="button"
                  className="type-label text-primary transition-colors hover:text-primary/80 focus-visible:underline focus-visible:outline-none"
                >
                  {t("forgotPassword")}
                </button>
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-sm"
                disabled={isSubmitting || authLoading}
              >
                {isSubmitting ? (
                  t("submitting")
                ) : (
                  <>
                    {t("submit")}
                    <ArrowRight />
                  </>
                )}
              </Button>

              <FieldSeparator className="[&_[data-slot=field-separator-content]]:bg-card">
                {t("or")}
              </FieldSeparator>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 w-full text-sm"
              >
                <Landmark />
                {t("sso")}
              </Button>
            </FieldGroup>
          </form>
        </div>

        <p className="mt-6 px-6 text-center type-meta text-muted-foreground">
          {t.rich("agreement", {
            terms: (chunks) => (
              <a href="#" className="text-primary hover:underline">
                {chunks}
              </a>
            ),
            privacy: (chunks) => (
              <a href="#" className="text-primary hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-control bg-primary font-heading text-lg font-bold text-primary-foreground">
        F
      </span>
      <span className="type-section-title text-xl text-card-foreground">
        Fusion
      </span>
    </div>
  );
}
