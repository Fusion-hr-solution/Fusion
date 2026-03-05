"use client";

import React from "react";
import { Button } from "@repo/ui";
import { useAuth } from "../auth-context";
import { clearAuth } from "../auth-service";

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
      <a href="/auth/signin">
        <Button variant="ghost" size="sm">
          Sign In
        </Button>
      </a>
      <a href="/auth/signup">
        <Button size="sm">Sign Up</Button>
      </a>
    </div>
  );
}
