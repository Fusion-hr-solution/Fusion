"use client";

import { Button } from "@/components/ui/button";

export default function OrganizationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-2xl font-bold tracking-tight mb-2">
        Failed to load organizations
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Something went wrong loading this page. Try again.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
