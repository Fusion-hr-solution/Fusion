# Sidebar Integration Guide

This guide explains how to integrate the shared `AppSidebar` into a new or existing module in the EY Fusion platform.

---

## Architecture Overview

The shared sidebar lives in `@repo/ui` and provides:

- **`AppSidebar`** — The main sidebar component (collapsible, EY-branded)
- **`ModuleSwitcher`** — A Radix Popover dropdown for navigating between platform modules
- **`SidebarNav`** — Renders navigation sections with active state styling
- **Types** — `NavItem`, `NavSection`, `SidebarModule`, `AppSidebarProps`

Each module creates a thin **wrapper component** (e.g., `CoreSidebar`) that configures the shared `AppSidebar` with module-specific branding, icons, and navigation items.

---

## Step-by-Step Integration

### 1. Import EY Brand CSS

The EY brand CSS variables and utility classes are centralized in `@repo/ui`. Import them in your module's `src/app/layout.tsx` **before** `globals.css`:

```tsx
import "@repo/ui/src/ey-brand.css";
import "./globals.css";
```

> **Do NOT** duplicate EY brand variables (`--ey-*`) in your module's `globals.css`. They are inherited from the shared stylesheet.

### 2. Create a Sidebar Wrapper Component

Create `src/components/<module>-sidebar.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { SomeIcon } from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";

// Define your nav sections
const MY_NAV: NavSection = {
  title: "Section Title",
  items: [
    { label: "Dashboard", href: "/", icon: SomeIcon },
    { label: "Reports",   href: "/reports", icon: AnotherIcon },
  ],
};

export function MyModuleSidebar() {
  const pathname = usePathname();
  // Strip the basePath prefix to get the internal route
  const activePath = pathname.replace(/^\/my-module/, "") || "/";

  return (
    <AppSidebar
      activeModule="My Module"        // Must match a label in the module switcher
      activePath={activePath}          // Used for active nav highlighting
      sections={[MY_NAV]}             // Array of NavSection objects
      brandIcon={SomeIcon}            // Icon for the sidebar header
      brandTitle="EY My Module"       // Title in sidebar header
      brandSubtitle="Optional Subtitle"
      footer={<OptionalFooter />}     // Optional JSX for sidebar footer
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
```

### 3. Update the Module Layout

Replace `AuthLayout` with `AuthProvider` + your sidebar in `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { AuthProvider } from "@repo/auth";
import { MyModuleSidebar } from "@/components/my-module-sidebar";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Module - Fusion",
  description: "...",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <MyModuleSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
```

> **Key points:**
> - Use `AuthProvider` (not `AuthLayout`) — the shared sidebar replaces the old navbar
> - The outer `div` uses `flex h-screen overflow-hidden` to create the sidebar layout
> - The `main` area uses `flex-1 overflow-y-auto` so content scrolls independently

---

## Customizing Navigation Items

### NavItem Structure

```ts
interface NavItem {
  label: string;        // Display text
  href: string;         // Route path (relative to module basePath)
  icon: LucideIcon;     // Lucide icon component
  badge?: string;       // Optional badge text (e.g., "New", "3")
}
```

### NavSection Structure

```ts
interface NavSection {
  title: string;        // Section heading (shown when sidebar is expanded)
  items: NavItem[];     // Navigation items in this section
}
```

### Multiple Sections

Pass multiple sections to render them with dividers between them:

```tsx
const EMPLOYEE_NAV: NavSection = {
  title: "Employee",
  items: [
    { label: "My Courses", href: "/my-courses", icon: BookOpen },
    { label: "Certificates", href: "/certificates", icon: Award },
  ],
};

const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Manage Courses", href: "/admin/courses", icon: Settings },
    { label: "Reports", href: "/admin/reports", icon: BarChart },
  ],
};

// In your sidebar component:
<AppSidebar sections={[EMPLOYEE_NAV, ADMIN_NAV]} ... />
```

### Empty Sidebar (No Nav Items)

If your module doesn't have navigation yet, pass an empty array:

```tsx
<AppSidebar sections={[]} ... />
```

The sidebar will still show the brand header and module switcher.

---

## AppSidebar Props Reference

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `activeModule` | `string` | Yes | Label matching a module in the switcher (e.g., `"Learning"`, `"Core"`) |
| `activePath` | `string` | Yes | Current route path within the module (e.g., `"/"`, `"/reports"`) |
| `sections` | `NavSection[]` | Yes | Navigation sections to render |
| `brandIcon` | `LucideIcon` | Yes | Icon for the sidebar header |
| `brandTitle` | `string` | Yes | Title text in the sidebar header |
| `brandSubtitle` | `string` | No | Subtitle text below the title |
| `footer` | `React.ReactNode` | No | Custom JSX rendered at the sidebar bottom |
| `userPanel` | `(collapsed: boolean) => React.ReactNode` | No | Render prop for user info & logout (use `SidebarUserPanel` from `@repo/auth`) |
| `modules` | `SidebarModule[]` | No | Override default module list in the switcher |

---

## Adding a Custom Footer

The `footer` prop accepts any React node. Example:

```tsx
function QuickStatsFooter() {
  return (
    <div className="rounded-xl bg-[hsl(var(--ey-yellow))]/8 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ey-grey-400))]">
        Quick Stats
      </p>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Completed</span>
          <span className="font-medium">12</span>
        </div>
      </div>
    </div>
  );
}

<AppSidebar footer={<QuickStatsFooter />} ... />
```

---

## User Panel (Name & Logout)

The `SidebarUserPanel` component from `@repo/auth` displays the authenticated user's name, email, avatar, and a logout button. It adapts its layout based on the sidebar's collapsed/expanded state.

```tsx
import { SidebarUserPanel } from "@repo/auth";

<AppSidebar
  userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
  ...
/>
```

- **Expanded:** Shows avatar initial, full name, email, and a "Sign out" button.
- **Collapsed:** Shows avatar initial and a small logout icon button.
- **Unauthenticated:** Shows a "Sign in" link.

> All 7 existing modules already include the `userPanel` prop.

---

## Customizing the Module Switcher

By default, the module switcher includes a **Home** link (to the shell) plus all 6 platform modules. To override:

```tsx
import { type SidebarModule } from "@repo/ui";
import { BookOpen, Users } from "lucide-react";

const CUSTOM_MODULES: SidebarModule[] = [
  { label: "Learning", href: "/learning", icon: BookOpen },
  { label: "Recruitment", href: "/recruitment", icon: Users },
];

<AppSidebar modules={CUSTOM_MODULES} ... />
```

---

## Existing Module Sidebar Wrappers

| Module | Component | File |
|--------|-----------|------|
| Shell | `ShellSidebar` | `apps/shell/src/components/shell-sidebar.tsx` |
| Interview | `InterviewSidebar` | `apps/interview/src/components/interview-sidebar.tsx` |
| Core | `CoreSidebar` | `apps/core/src/components/core-sidebar.tsx` |
| Performance | `PerformanceSidebar` | `apps/performance/src/shell/navigation/performance-sidebar.tsx` |
| Recruitment | `RecruitmentSidebar` | `apps/recruitment/src/components/recruitment-sidebar.tsx` |
| Onboarding | `OnboardingSidebar` | `apps/onboarding/src/components/onboarding-sidebar.tsx` |
| Learning | `LearningSidebar` | `apps/learning/src/components/learning-sidebar.tsx` |

Use these as references when creating sidebar wrappers for new modules.
