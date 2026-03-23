"use client";

import { LogOut, LogIn } from "lucide-react";
import { useAuth } from "../auth-context";

interface SidebarUserPanelProps {
  collapsed: boolean;
}

export function SidebarUserPanel({ collapsed }: SidebarUserPanelProps) {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-1">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[hsl(var(--ey-grey-200))]" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const initial = user.fullName?.charAt(0)?.toUpperCase() || "U";

    if (collapsed) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-200))] text-xs font-bold text-[hsl(var(--ey-grey-500))]"
            title={user.fullName}
          >
            {initial}
          </div>
          <button
            onClick={async () => {
              await logout();
              window.location.href = "/auth/signin";
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--ey-grey-400))] hover:bg-[hsl(var(--ey-grey-100))] hover:text-[hsl(var(--ey-grey-500))] transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-200))] text-xs font-bold text-[hsl(var(--ey-grey-500))]">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-[hsl(var(--ey-grey-500))]">
            {user.fullName}
          </p>
          <p className="truncate text-xs text-[hsl(var(--ey-grey-400))]">
            {user.email}
          </p>
        </div>
        <button
          onClick={async () => {
            await logout();
            window.location.href = "/auth/signin";
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--ey-grey-400))] hover:bg-[hsl(var(--ey-grey-100))] hover:text-[hsl(var(--ey-grey-500))] transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Not authenticated
  if (collapsed) {
    return (
      <a
        href="/auth/signin"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--ey-grey-400))] hover:bg-[hsl(var(--ey-grey-100))] transition-colors mx-auto"
        title="Sign in"
      >
        <LogIn className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <a
      href="/auth/signin"
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-[hsl(var(--ey-grey-400))] hover:bg-[hsl(var(--ey-grey-100))] hover:text-[hsl(var(--ey-grey-500))] transition-colors"
    >
      <LogIn className="h-4 w-4 shrink-0" />
      <span>Sign In</span>
    </a>
  );
}
