"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

export interface SignInPageProps {
  /** Called after successful login or when already authenticated. Defaults to callbackUrl/next or "/" */
  onSuccess?: () => void;
  /** URL for sign up link. Defaults to "/auth/signup" */
  signUpUrl?: string;
}

function isSafeInternalRedirect(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function resolveRedirectTarget(searchParams: Pick<URLSearchParams, "get">): string {
  const candidate = searchParams.get("callbackUrl") ?? searchParams.get("next");
  return isSafeInternalRedirect(candidate) ? candidate : "/";
}

export function SignInPage({
  onSuccess,
  signUpUrl = "/auth/signup",
}: SignInPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading: authLoading, isAuthenticated } = useAuth();
  const redirectTarget = resolveRedirectTarget(searchParams);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace(redirectTarget);
      }
    }
  }, [authLoading, isAuthenticated, router, onSuccess, redirectTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });

      if (result) {
        setErrors(result);
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(redirectTarget);
        }
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
              Don&apos;t have an account?{" "}
              <Link
                href={signUpUrl}
                className="text-primary underline-offset-4 hover:underline font-medium"
              >
                Sign Up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
