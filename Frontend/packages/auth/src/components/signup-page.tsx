"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  CardFooter,
} from "@repo/ui";
import { useAuth } from "../auth-context";

export interface SignUpPageProps {
  /** Called when already authenticated. Defaults to router.push("/") */
  onSuccess?: () => void;
  /** URL for sign in link. Defaults to "/auth/signin" */
  signInUrl?: string;
}

export function SignUpPage({
  onSuccess,
  signInUrl = "/auth/signin",
}: SignUpPageProps) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace("/");
      }
    }
  }, [authLoading, isAuthenticated, router, onSuccess]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="type-page-title">Invitation required</h1>
          <CardDescription>
            Platform access starts from a trusted employee record.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            Ask your HR administrator for an invitation link. If email delivery
            is disabled, they can copy the setup link from CoreHR.
          </p>
        </CardContent>

        <CardFooter>
          <Button asChild className="w-full">
            <Link href={signInUrl}>Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
