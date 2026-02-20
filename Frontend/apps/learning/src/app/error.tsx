"use client";

import { Button } from "@repo/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {error.message || "An unexpected error occurred in the Learning module."}
        </p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
