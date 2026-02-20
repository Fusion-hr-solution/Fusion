# Frontend — Turborepo Microfrontend Monorepo

A production-ready microfrontend architecture built with **Turborepo**, **Next.js 15**, **React 19**, **TypeScript 5**, and **shadcn/ui**.

---

## Architecture Overview

This monorepo uses **Next.js `rewrites()`** in the shell app to compose multiple independent Next.js applications into a unified experience during development. Each microfrontend runs on its own port and is proxied through the shell at **`http://localhost:3000`**.

```
Frontend/
├── apps/
│   ├── shell/             → Host / container app           — port 3000
│   ├── interview/         → Interview management MFE       — port 3001
│   ├── core/              → Core platform MFE              — port 3002
│   ├── learning/          → Learning & courses MFE         — port 3003
│   ├── performance/       → Performance reviews MFE        — port 3004
│   ├── recruitment/       → Recruitment & hiring MFE       — port 3005
│   └── onboarding/        → New hire onboarding MFE        — port 3006
├── packages/
│   ├── ui/                → Shared UI components (shadcn/ui + Tailwind)
│   ├── eslint-config/     → Shared ESLint configuration
│   └── tsconfig/          → Shared TypeScript configurations
├── turbo.json             → Turborepo task pipeline
├── pnpm-workspace.yaml    → pnpm workspace definition
└── package.json           → Root scripts & tooling
```

### Unified App Folder Structure

Every app follows the same Next.js best-practice folder layout:

```
src/
├── app/
│   ├── globals.css        → Global styles (Tailwind directives)
│   ├── layout.tsx         → Root layout with navigation
│   ├── page.tsx           → Async server component (fetches data from services)
│   ├── loading.tsx        → Streaming / Suspense skeleton UI
│   ├── error.tsx          → Client-side error boundary
│   └── not-found.tsx      → Custom 404 page
├── components/            → Feature-specific UI components + barrel index.ts
├── hooks/                 → Custom React hooks
├── lib/                   → Utility functions (cn, formatters)
├── services/              → Data-fetching / API layer (async functions)
├── types/                 → TypeScript interfaces & type declarations
└── config/                → Constants, enums, app configuration
```

---

## How Microfrontends Are Wired

The shell app uses **Next.js `rewrites()`** to proxy each microfrontend path to its dedicated dev server:

| Path               | App           | Port |
|--------------------|---------------|------|
| `/`                | shell         | 3000 |
| `/interview/*`     | interview     | 3001 |
| `/core/*`          | core          | 3002 |
| `/learning/*`      | learning      | 3003 |
| `/performance/*`   | performance   | 3004 |
| `/recruitment/*`   | recruitment   | 3005 |
| `/onboarding/*`    | onboarding    | 3006 |

Each MFE has a `basePath` in its `next.config.ts` matching its route prefix (e.g., `basePath: "/interview"`).

> **Note:** Use standard `<a>` tags (not Next.js `<Link>`) for cross-app navigation, since each microfrontend is a separate Next.js application.

---

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9.x

## Getting Started

```bash
cd Frontend
pnpm install
```

## Scripts

### Development

```bash
# Start all apps concurrently (access at http://localhost:3000)
pnpm dev

# Start a single app
pnpm --filter shell dev
pnpm --filter interview dev
```

### Build, Lint & Type-check

```bash
pnpm build        # Build all apps (dependency-ordered)
pnpm lint         # ESLint across all packages
pnpm type-check   # TypeScript compiler checks
pnpm format       # Prettier formatting
```

### Turbo Tasks

| Task           | Description                                |
|----------------|--------------------------------------------|
| `dev`          | Start all apps in parallel                 |
| `build`        | Production build with dependency ordering  |
| `lint`         | Run ESLint across all packages             |
| `type-check`   | Run TypeScript compiler checks             |

---

## Shared Packages

### `@repo/ui` — Component Library

Reusable components built with **shadcn/ui**, **Radix UI**, and **Tailwind CSS**.

```tsx
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Label, Badge } from "@repo/ui";
```

| Component   | Description                                                        |
|-------------|--------------------------------------------------------------------|
| `Button`    | Variants: default, destructive, outline, secondary, ghost, link    |
| `Card`      | With CardHeader, CardTitle, CardDescription, CardContent, CardFooter|
| `Input`     | Styled text input                                                  |
| `Label`     | Form label                                                         |
| `Badge`     | Variants: default, secondary, destructive, outline                 |

**Adding a new shared component:**

```tsx
// 1. Create: packages/ui/src/components/my-component.tsx
import * as React from "react";
import { cn } from "../lib/utils";

export function MyComponent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-styles", className)} {...props} />;
}

// 2. Export: packages/ui/src/index.ts
export { MyComponent } from "./components/my-component";

// 3. Use in any app:
import { MyComponent } from "@repo/ui";
```

### `@repo/eslint-config`

Shared config including:
- `eslint:recommended` + `@typescript-eslint/recommended`
- `next/core-web-vitals` (for Next.js apps)
- Prettier integration

### `@repo/tsconfig`

| Config                                | Usage              |
|---------------------------------------|--------------------|
| `@repo/tsconfig/base.json`           | Strict base config |
| `@repo/tsconfig/nextjs.json`         | Next.js apps       |
| `@repo/tsconfig/react-library.json`  | React libraries    |

All use strict mode with `noUncheckedIndexedAccess` enabled.

---

## Husky Pre-commit Hooks

Automatically runs before each commit:

```bash
pnpm lint
pnpm type-check
```

---

## Adding a New Microfrontend

1. **Create the app** in `apps/my-app/` (Next.js with App Router)
2. **Set `basePath`** in `apps/my-app/next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     basePath: "/my-app",
     transpilePackages: ["@repo/ui"],
     allowedDevOrigins: ["http://localhost:3000"],
   };
   ```
3. **Assign a port** in `apps/my-app/package.json`:
   ```json
   "scripts": { "dev": "next dev --turbopack -p 3007" }
   ```
4. **Add a rewrite** in `apps/shell/next.config.ts`:
   ```ts
   { source: "/my-app/:path*", destination: "http://localhost:3007/my-app/:path*" }
   ```
5. **Add navigation links** in the shell and other app layouts
6. **Scaffold the folder structure** following the unified convention (`components/`, `services/`, `types/`, `lib/`, `config/`, `hooks/`)
7. Run `pnpm dev` — access at `http://localhost:3000/my-app`

---

## Production Deployment

The shell's `rewrites()` proxy is for **local development only**. For production:

- Deploy each app independently (e.g., to Vercel, AWS, Azure)
- Use a reverse proxy (Nginx, CloudFront, or Vercel Zones) to route paths to the correct app
- Each MFE's `basePath` ensures assets and routes are correctly namespaced

---

## Tech Stack

| Technology       | Version  | Purpose                              |
|------------------|----------|--------------------------------------|
| Turborepo        | 2.8.9    | Monorepo build orchestration         |
| Next.js          | 15.5.12  | React framework (App Router)         |
| React            | 19.0.0   | UI library                           |
| TypeScript       | 5.7.3    | Static typing (strict mode)          |
| Tailwind CSS     | 3.4.17   | Utility-first CSS                    |
| shadcn/ui        | —        | Accessible component primitives      |
| Radix UI         | —        | Headless UI primitives               |
| pnpm             | 9.15.4   | Package manager                      |
| Husky            | 9.1.7    | Git hooks                            |
| ESLint + Prettier| —        | Code quality & formatting            |
