"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { useAuth } from "@/hooks/use-auth";

export function AuthButtons() {
  const router = useRouter();
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user.fullName}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await logout();
            router.push("/auth/signin");
          }}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.push("/auth/signin")}>
        Sign In
      </Button>
      <Button size="sm" onClick={() => router.push("/auth/signup")}>
        Sign Up
      </Button>
    </div>
  );
}
