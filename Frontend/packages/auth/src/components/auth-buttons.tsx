"use client";

import React from "react";
import { Button } from "@repo/ui";
import { useAuth } from "../auth-context";

export function AuthButtons() {
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
            window.location.href = "/auth/signin";
          }}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <a href="/auth/signin">Sign In</a>
      </Button>
      <Button size="sm" asChild>
        <a href="/auth/signup">Sign Up</a>
      </Button>
    </div>
  );
}
