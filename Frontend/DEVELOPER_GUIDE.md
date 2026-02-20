# Developer Guide — Frontend Monorepo

Rules, best practices, and conventions for contributing to this Turborepo microfrontend monorepo.

---

## Table of Contents

- [Development Workflow](#development-workflow)
- [Project Structure Rules](#project-structure-rules)
- [TypeScript Rules](#typescript-rules)
- [Component Guidelines](#component-guidelines)
- [Styling Guidelines](#styling-guidelines)
- [Data Fetching & Services](#data-fetching--services)
- [State Management](#state-management)
- [Cross-App Navigation](#cross-app-navigation)
- [Import Conventions](#import-conventions)
- [Naming Conventions](#naming-conventions)
- [ESLint Rules](#eslint-rules)
- [Git Workflow & Hooks](#git-workflow--hooks)
- [Adding a New Feature](#adding-a-new-feature)
- [Adding a New Microfrontend](#adding-a-new-microfrontend)
- [Shared Package Development](#shared-package-development)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Performance Best Practices](#performance-best-practices)
- [Do's and Don'ts](#dos-and-donts)

---

## Development Workflow

### Starting Development

```bash
cd Frontend
pnpm install          # Install all dependencies
pnpm dev              # Start all 7 apps concurrently
```

Access the unified app at **http://localhost:3000**. The shell proxies all MFE routes via Next.js `rewrites()`.

### Useful Commands

| Command                       | Purpose                                 |
|-------------------------------|-----------------------------------------|
| `pnpm dev`                    | Start all apps                          |
| `pnpm build`                  | Production build (all apps)             |
| `pnpm lint`                   | Lint all packages                       |
| `pnpm type-check`             | TypeScript compiler checks              |
| `pnpm format`                 | Prettier formatting                     |
| `pnpm --filter <app> dev`     | Start a single app                      |
| `pnpm --filter <app> build`   | Build a single app                      |

### Working on a Single App

To work on just one MFE without starting everything:

```bash
pnpm --filter interview dev    # Starts on http://localhost:3001/interview
pnpm --filter core dev         # http://localhost:3002/core
```

> **Note:** Cross-app navigation won't work when running a single app in isolation. Start the shell alongside the target MFE for full navigation.

---

## Project Structure Rules

### Every MFE Must Follow This Layout

```
src/
├── app/                    # Next.js App Router pages
│   ├── globals.css         # Tailwind directives — DO NOT add custom CSS here unless global
│   ├── layout.tsx          # Root layout — navigation + metadata
│   ├── page.tsx            # Main page — async server component
│   ├── loading.tsx         # Suspense fallback skeleton
│   ├── error.tsx           # Error boundary ("use client")
│   └── not-found.tsx       # Custom 404
├── components/             # UI components scoped to this MFE
│   ├── index.ts            # Barrel exports — REQUIRED
│   ├── feature-card.tsx
│   └── stat-card.tsx
├── hooks/                  # Custom React hooks
│   └── index.ts            # Barrel exports
├── lib/                    # Pure utility functions
│   └── utils.ts            # cn() helper, formatters
├── services/               # Data-fetching layer
│   └── <app>-service.ts    # Async functions returning typed data
├── types/                  # TypeScript interfaces & declarations
│   ├── index.ts            # Domain types
│   └── css.d.ts            # CSS module declarations
└── config/                 # Constants & configuration
    └── constants.ts        # APP_NAME, enums, static config
```

### Rules

1. **No business logic in `page.tsx`** — pages are thin orchestrators that call services and render components.
2. **No inline data** — mock or real data goes in `services/`.
3. **No cross-MFE imports** — MFEs must not import from each other's `src/`. Use `@repo/ui` for shared components.
4. **Barrel exports are mandatory** — every `components/`, `hooks/` directory must have an `index.ts`.
5. **One component per file** — no multi-component files.

---

## TypeScript Rules

### Strict Mode Is Enforced

The shared base tsconfig enables:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "forceConsistentCasingInFileNames": true,
  "isolatedModules": true
}
```

### Rules

| Rule | Enforcement |
|------|-------------|
| No `any` | ESLint error — `@typescript-eslint/no-explicit-any: "error"` |
| Use `type` imports | ESLint warn — `@typescript-eslint/consistent-type-imports` |
| No unused variables | ESLint error — prefix with `_` to ignore |
| Check indexed access | tsconfig — `noUncheckedIndexedAccess: true` |

### Type Import Syntax

Always use `type` imports for types and interfaces:

```tsx
// ✅ Correct
import { type Interview } from "@/types";
import { type NextConfig } from "next";

// ❌ Wrong
import { Interview } from "@/types";
```

### Define Types in `types/index.ts`

Use string literal unions for status-like fields:

```tsx
// ✅ Correct — src/types/index.ts
export interface Interview {
  id: string;
  candidate: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
}

// ❌ Wrong — inline type or `string`
const interview: { status: string } = { status: "scheduled" };
```

### Path Aliases

All apps use `@/*` → `./src/*`. Always use path aliases:

```tsx
// ✅ Correct
import { InterviewCard } from "@/components";
import { getInterviews } from "@/services/interview-service";
import { type Interview } from "@/types";

// ❌ Wrong
import { InterviewCard } from "../../components/interview-card";
import { InterviewCard } from "../components";
```

---

## Component Guidelines

### Server Components by Default

Pages and data-fetching components should be **async server components** (the default in Next.js App Router):

```tsx
// ✅ Server component (default) — no "use client"
export default async function InterviewPage() {
  const interviews = await getInterviews();
  return <InterviewCard interview={interviews[0]!} />;
}
```

### Client Components Only When Needed

Add `"use client"` only when you need:
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- React hooks (`useState`, `useEffect`, `useRef`)
- Browser APIs (`window`, `document`)

```tsx
"use client";

import { useState } from "react";
import { Button, Input } from "@repo/ui";

export function ScheduleInterviewForm() {
  const [candidate, setCandidate] = useState("");
  // ...
}
```

### Component File Structure

```tsx
// 1. Imports
import { Card, CardHeader, CardTitle, Badge } from "@repo/ui";
import { type Interview } from "@/types";

// 2. Types (component-specific — for shared types use types/index.ts)
interface InterviewCardProps {
  interview: Interview;
}

// 3. Component (named export — NOT default)
export function InterviewCard({ interview }: InterviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{interview.candidate}</CardTitle>
      </CardHeader>
    </Card>
  );
}
```

### Rules

| Rule | Details |
|------|---------|
| Named exports only | `export function MyCard()` — never `export default` for components |
| Props interface | Always define a `Props` interface above the component |
| Use `@repo/ui` primitives | Button, Card, Badge, Input, Label — don't recreate these |
| Barrel exports | Add every component to `components/index.ts` |

### Barrel Export Example

```tsx
// src/components/index.ts
export { InterviewCard } from "./interview-card";
export { InterviewStatusBadge } from "./interview-status-badge";
export { ScheduleInterviewForm } from "./schedule-interview-form";
```

---

## Styling Guidelines

### Use Tailwind CSS Utility Classes

```tsx
// ✅ Correct
<div className="flex items-center gap-4 rounded-lg border p-4">

// ❌ Wrong — no CSS modules, no inline styles
<div style={{ display: "flex", alignItems: "center" }}>
<div className={styles.container}>
```

### Use `cn()` for Conditional Classes

```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-primary bg-primary/5",
  className
)} />
```

### Shared Tailwind Config

All apps extend `@repo/ui/tailwind.config`. Do not override the base theme — extend it in the shared config.

### Rules

1. **No CSS modules** — use Tailwind utilities.
2. **No inline styles** — exception: dynamic values like `style={{ width: \`${progress}%\` }}`.
3. **No `!important`** — if specificity is an issue, restructure the class order.
4. **Responsive design** — use Tailwind breakpoints (`sm:`, `md:`, `lg:`).
5. **Dark mode ready** — use semantic colors (`bg-background`, `text-foreground`, `text-muted-foreground`).

---

## Data Fetching & Services

### Service Layer Pattern

All data fetching goes through the `services/` directory:

```tsx
// src/services/interview-service.ts
import { type Interview } from "@/types";

const MOCK_INTERVIEWS: Interview[] = [
  { id: "1", candidate: "Alice", role: "Engineer", status: "scheduled", date: "2026-02-20" },
];

export async function getInterviews(): Promise<Interview[]> {
  // TODO: Replace with actual API call
  return MOCK_INTERVIEWS;
}

export async function getInterviewById(id: string): Promise<Interview | undefined> {
  return MOCK_INTERVIEWS.find((i) => i.id === id);
}
```

### Rules

1. **Always return typed data** — use explicit return types: `Promise<Interview[]>`.
2. **Always `async`** — even for mock data, so the call site doesn't change when APIs are added.
3. **Mark TODOs** — add `// TODO: Replace with actual API call` on mock functions.
4. **No `fetch()` in components** — always go through `services/`.
5. **Handle errors in services** — throw descriptive errors, let `error.tsx` catch them.

### Consuming in Pages

```tsx
// src/app/page.tsx
import { getInterviews } from "@/services/interview-service";

export default async function InterviewPage() {
  const interviews = await getInterviews(); // Server-side data fetching
  return <div>{/* render */}</div>;
}
```

---

## State Management

### Prefer Server Components

Most data should be fetched on the server. Avoid client-side state for data that can be server-fetched.

### Client State Rules

| When | Use |
|------|-----|
| Form inputs | `useState` |
| Toggle / UI state | `useState` |
| Complex form state | `useReducer` |
| Server-fetched data | Server Components (no client state needed) |
| Cross-component state | Lift state up or use React Context |

> **No global state libraries** (Redux, Zustand, Jotai) unless explicitly approved. Server Components + services handle most needs.

---

## Cross-App Navigation

### Use `<a>` Tags — NOT `<Link>`

Each MFE is a separate Next.js app. `next/link` only works for intra-app navigation:

```tsx
// ✅ Cross-app navigation (between MFEs)
<a href="/interview">Interview</a>
<a href="/core">Core</a>

// ✅ Intra-app navigation (within the same MFE)
import Link from "next/link";
<Link href="/interview/details/123">View Details</Link>

// ❌ Wrong — won't work across MFEs
import Link from "next/link";
<Link href="/core">Core</Link>  // This will 404 in the interview app
```

---

## Import Conventions

### Import Order

Follow this order (enforced by convention, not auto-sorted):

```tsx
// 1. React / Next.js
import { useState } from "react";
import Link from "next/link";

// 2. External packages
import { type ClassValue, clsx } from "clsx";

// 3. Shared packages (@repo/*)
import { Button, Card, Badge } from "@repo/ui";

// 4. Internal aliases (@/*)
import { InterviewCard } from "@/components";
import { getInterviews } from "@/services/interview-service";
import { type Interview } from "@/types";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/config/constants";
```

### Rules

1. **Use `@repo/ui`** for shared UI — never import from `../../packages/ui`.
2. **Use `@/*`** for internal imports — never use relative paths across directories.
3. **Use `type` keyword** for type-only imports.
4. **No circular imports** — services don't import from components.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files (components) | `kebab-case.tsx` | `interview-card.tsx` |
| Files (services) | `kebab-case.ts` | `interview-service.ts` |
| Files (hooks) | `kebab-case.ts` | `use-interviews.ts` |
| Components | `PascalCase` | `InterviewCard` |
| Interfaces | `PascalCase` | `Interview`, `InterviewCardProps` |
| Functions | `camelCase` | `getInterviews`, `formatDate` |
| Constants | `UPPER_SNAKE_CASE` | `APP_NAME`, `INTERVIEW_STATUSES` |
| Hooks | `camelCase` with `use` prefix | `useInterviews` |
| Type unions | String literal unions | `"scheduled" \| "in-progress"` |
| Directories | `kebab-case` | `components/`, `services/` |

---

## ESLint Rules

### Active Rules

| Rule | Level | Details |
|------|-------|---------|
| `@typescript-eslint/no-explicit-any` | Error | Use `unknown` or proper types instead |
| `@typescript-eslint/no-unused-vars` | Error | Prefix unused vars with `_` |
| `@typescript-eslint/consistent-type-imports` | Warn | Use `import { type X }` |
| `next/core-web-vitals` | Error | Next.js performance rules |
| `eslint:recommended` | Error | Standard JS best practices |
| `prettier` | — | Auto-formatting integration |

### Suppressing Lint Errors

```tsx
// ✅ Acceptable — with explanation
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy API response shape
const response = data as any;

// ❌ Wrong — blanket disable
// eslint-disable
```

Never commit blanket `eslint-disable` without a specific rule and explanation.

---

## Git Workflow & Hooks

### Pre-commit (Husky)

Every commit automatically runs:

```bash
pnpm lint          # Must pass — zero errors
pnpm type-check    # Must pass — zero TS errors
```

If either fails, the commit is blocked. Fix all issues before committing.

### Branch Naming

```
feature/<mfe>-<description>    # feature/interview-add-filters
fix/<mfe>-<description>        # fix/core-settings-crash
chore/<scope>-<description>    # chore/ui-update-button-variants
```

### Commit Messages

Use conventional commits:

```
feat(interview): add interview filter component
fix(core): resolve settings form validation
chore(ui): update Badge component variants
docs: update developer guide
```

---

## Adding a New Feature

### Step-by-step for adding a feature to an existing MFE:

1. **Define types** in `src/types/index.ts`
2. **Create service function** in `src/services/<app>-service.ts` (even if mocked)
3. **Build components** in `src/components/`, one per file
4. **Add barrel exports** in `src/components/index.ts`
5. **Wire into the page** — import from `@/components` and `@/services`
6. **Add constants** to `src/config/constants.ts` if needed
7. **Run checks**: `pnpm lint && pnpm type-check`

### Example: Adding a "Filter" feature to Interview

```bash
# 1. Add type
# src/types/index.ts
export interface InterviewFilter {
  status?: Interview["status"];
  dateRange?: { from: string; to: string };
}

# 2. Add service function
# src/services/interview-service.ts
export async function getFilteredInterviews(filter: InterviewFilter): Promise<Interview[]> {
  // implementation
}

# 3. Create component
# src/components/interview-filter.tsx

# 4. Export it
# src/components/index.ts
export { InterviewFilter } from "./interview-filter";

# 5. Use in page
# src/app/page.tsx
```

---

## Adding a New Microfrontend

1. **Copy an existing MFE** as a template (e.g., `apps/interview/`)
2. **Update `package.json`**: name, port (`next dev --turbopack -p <PORT>`)
3. **Set `basePath`** in `next.config.ts`
4. **Add `allowedDevOrigins`** in `next.config.ts`: `["http://localhost:3000"]`
5. **Add rewrite** in `apps/shell/next.config.ts`
6. **Add nav link** in shell's `layout.tsx` and all other MFE layouts
7. **Scaffold folders**: `components/`, `services/`, `types/`, `lib/`, `config/`, `hooks/`
8. **Run**: `pnpm install && pnpm dev`

### Port Assignment

| Port | App |
|------|-----|
| 3000 | shell |
| 3001 | interview |
| 3002 | core |
| 3003 | learning |
| 3004 | performance |
| 3005 | recruitment |
| 3006 | onboarding |
| 3007+ | New MFEs |

---

## Shared Package Development

### `@repo/ui` — Adding Components

```bash
# 1. Create the component
packages/ui/src/components/my-widget.tsx

# 2. Export from index
packages/ui/src/index.ts → export { MyWidget } from "./components/my-widget";

# 3. Use in any app
import { MyWidget } from "@repo/ui";
```

### Rules for Shared Packages

1. **No app-specific logic** — `@repo/ui` must be generic and reusable.
2. **No data fetching** — UI components receive data via props.
3. **Use CVA** (class-variance-authority) for component variants.
4. **Follow shadcn/ui patterns** — check [ui.shadcn.com](https://ui.shadcn.com) for conventions.
5. **Peer dependencies** — React is a peer dep, not a direct dependency.

---

## Debugging & Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `EBUSY: resource busy or locked` on `.next/` | Kill node processes, delete `.next/`, rebuild |
| CSS not loading | Ensure `globals.css` is imported in `layout.tsx` |
| Cross-app links 404 | Use `<a>` tags, not `<Link>` — check shell rewrites |
| Type errors after adding shared component | Run `pnpm install` to rebuild workspace links |
| `Module not found: @/components` | Check `tsconfig.json` has `paths: { "@/*": ["./src/*"] }` |
| Port already in use | Kill the process: `npx kill-port 3001` |
| `allowedDevOrigins` error | Add `allowedDevOrigins: ["http://localhost:3000"]` to MFE configs |

### Clearing Build Cache

```bash
# Clear all .next build directories
Remove-Item -Recurse -Force apps\*\.next

# Clear Turbo cache
Remove-Item -Recurse -Force .turbo
Remove-Item -Recurse -Force node_modules\.cache

# Full clean rebuild
pnpm install && pnpm build
```

### Debugging a Single App

```bash
# Run one app with verbose output
pnpm --filter interview dev

# Type-check one app
pnpm --filter interview type-check

# Lint one app
pnpm --filter interview lint
```

---

## Performance Best Practices

1. **Prefer Server Components** — they have zero client-side JS bundle cost.
2. **Mark `"use client"` only on leaf components** — not on pages or layouts.
3. **Use `loading.tsx`** for streaming — provides instant UI feedback.
4. **Keep shared bundle small** — import only what you need from `@repo/ui`.
5. **Avoid prop-drilling state** — use composition and server components instead.
6. **Use `next/image`** for images — automatic optimization.
7. **Use `next/font`** for fonts — no layout shift.
8. **Lazy load heavy components**:
   ```tsx
   import dynamic from "next/dynamic";
   const HeavyChart = dynamic(() => import("@/components/heavy-chart"), { ssr: false });
   ```

---

## Do's and Don'ts

### Do

- ✅ Use `async` server components for data-fetching pages
- ✅ Define interfaces in `types/index.ts`
- ✅ Use `@repo/ui` for shared UI primitives
- ✅ Use `@/*` path aliases for all internal imports
- ✅ Keep components small and single-purpose
- ✅ Add `loading.tsx` and `error.tsx` for every route segment
- ✅ Use string literal unions for status fields
- ✅ Write service functions as `async` even for mock data
- ✅ Use `cn()` from `@/lib/utils` for conditional class merging
- ✅ Export constants from `config/constants.ts`

### Don't

- ❌ Import across MFE boundaries (`apps/interview` → `apps/core`)
- ❌ Use `any` — use `unknown` or proper types
- ❌ Put business logic in `page.tsx`
- ❌ Use CSS modules or inline styles
- ❌ Use `next/link` for cross-app navigation
- ❌ Add global state libraries without team approval
- ❌ Skip barrel exports in `components/index.ts`
- ❌ Commit with lint or type errors (Husky will block you)
- ❌ Override the shared Tailwind theme in individual apps
- ❌ Use `export default` for components (only for pages/layouts)
