"use client";

import { Button } from "@repo/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="ey-animate-scale-in flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--ey-red-500))]/10 mb-5">
          <AlertTriangle className="h-8 w-8 text-[hsl(var(--ey-red-500))]" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-md leading-relaxed">
          {error.message ||
            "An unexpected error occurred in the Learning module. Please try again."}
        </p>
        <Button
          onClick={reset}
          className="ey-bg-dark hover:ey-bg-dark-deep text-white gap-2 shadow-md hover:shadow-lg transition-all"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
