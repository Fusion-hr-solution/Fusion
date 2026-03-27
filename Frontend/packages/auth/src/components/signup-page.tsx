"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export interface SignUpPageProps {
  /** Called after successful registration. Defaults to router.push("/") */
  onSuccess?: () => void;
  /** URL for sign in link. Defaults to "/auth/signin" */
  signInUrl?: string;
}

export function SignUpPage({
  onSuccess,
  signInUrl = "/auth/signin",
}: SignUpPageProps) {
  const router = useRouter();
  const { register, isLoading: authLoading, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Client-side validation
    if (password !== confirmPassword) {
      setErrors(["Passwords do not match."]);
      return;
    }

    if (password.length < 8) {
      setErrors(["Password must be at least 8 characters."]);
      return;
    }

    setIsSubmitting(true);

    const result = await register({
      email,
      password,
      firstName,
      lastName,
      department: department || undefined,
      jobTitle: jobTitle || undefined,
      hireDate: hireDate || new Date().toISOString(),
    });

    if (result) {
      setErrors(result);
      setIsSubmitting(false);
    } else {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Fill in your details to get started
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

            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

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
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">
                  Department <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="department"
                  placeholder="Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">
                  Job Title <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="jobTitle"
                  placeholder="Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hireDate">
                Hire Date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="hireDate"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || authLoading}
            >
              {isSubmitting ? "Creating account…" : "Sign Up"}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <a
                href={signInUrl}
                className="text-primary underline-offset-4 hover:underline font-medium"
              >
                Sign In
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
