"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback";

export default function EmployeesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error("Employees page error:", error);
  }, [error]);

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your organization&apos;s employee directory
        </p>
      </div>
      <div className="border rounded-md">
        <ErrorState
          title="Failed to load employees"
          message={error.message || "An unexpected error occurred."}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
