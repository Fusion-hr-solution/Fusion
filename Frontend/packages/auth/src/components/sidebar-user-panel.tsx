"use client";

import { useState } from "react";
import {
  LogOut,
  LogIn,
  User,
  Settings,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../auth-context";

interface SidebarUserPanelProps {
  collapsed: boolean;
}

export function SidebarUserPanel({ collapsed }: SidebarUserPanelProps) {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-1">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[hsl(var(--ey-grey-200))]" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const initial = user.fullName?.charAt(0)?.toUpperCase() || "U";
    const role = user.roles?.[0] || "User";

    if (collapsed) {
      return (
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--ey-black))] text-xs font-bold text-white"
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
      <div className="relative">
        {/* Dropdown menu — rendered above the trigger */}
        {menuOpen && (
          <>
            {/* Invisible backdrop to close the menu */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-lg border border-[hsl(var(--ey-grey-200))] bg-white py-1 shadow-lg">
              <a
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 text-sm text-[hsl(var(--ey-grey-500))] hover:bg-[hsl(var(--ey-grey-100))] transition-colors"
              >
                <User className="h-4 w-4 text-[hsl(var(--ey-grey-400))]" />
                Profile
              </a>
              <a
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 text-sm text-[hsl(var(--ey-grey-500))] hover:bg-[hsl(var(--ey-grey-100))] transition-colors"
              >
                <Settings className="h-4 w-4 text-[hsl(var(--ey-grey-400))]" />
                Settings
              </a>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await logout();
                  window.location.href = "/auth/signin";
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[hsl(var(--ey-grey-500))] hover:bg-[hsl(var(--ey-grey-100))] transition-colors"
              >
                <LogOut className="h-4 w-4 text-[hsl(var(--ey-grey-400))]" />
                Logout
              </button>
            </div>
          </>
        )}

        {/* Trigger — user info row */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-[hsl(var(--ey-grey-100))] transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ey-black))] text-xs font-bold text-white">
            {initial}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="truncate text-sm font-medium text-[hsl(var(--ey-grey-500))]">
              {user.fullName}
            </p>
            <p className="truncate text-xs text-[hsl(var(--ey-grey-400))]">
              {role}
            </p>
          </div>
          {menuOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--ey-grey-400))]" />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0 text-[hsl(var(--ey-grey-400))]" />
          )}
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
