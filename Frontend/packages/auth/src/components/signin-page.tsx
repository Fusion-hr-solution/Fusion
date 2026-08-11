"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
} from "@repo/ui";
import { useAuth } from "../auth-context";
import { loadAuth } from "../auth-service";
import type { AuthUser } from "../types";
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
  const searchParams = useSearchParams();
  const { login, user, isLoading: authLoading, isAuthenticated } = useAuth();
  const intended = intendedDestination(searchParams);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        setErrors(result);
      } else {
        await finishSignIn(loadAuth()?.user ?? null, "push");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || authLoading}
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Need platform access? Ask your HR administrator for an invitation link.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
