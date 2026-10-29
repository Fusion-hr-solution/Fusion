---
name: repo-ui-consolidation
description: "Frontend design-system consolidation removing @repo/ui in favor of @repo/ds, tracked in passes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4bad446e-6c6c-490b-a785-d01b2e2a6f20
  modified: 2026-08-07T20:48:47.767Z
---

Multi-pass effort to remove the legacy `@repo/ui` package from Fusion frontend surfaces in favor of `@repo/ds` (the intended shared product DS). Dependency/foundation migration, NOT a redesign.

**Pass 1 (done, verified, uncommitted 2026-08-07):** removed `@repo/ui` from `apps/platform` (already clean), `apps/core`, `apps/performance`. Core was the only real consumer — Button → `@/components/ui/button` (ds alias); non-visual pagination/debounce constants (`PAGE_SIZE_OPTIONS`/`DEFAULT_PAGE_SIZE`/`SEARCH_DEBOUNCE_MS`/`PageSize`) moved to app-local `apps/core/src/lib/table-config.ts` (NOT promoted into ds). Performance was a dead config-only dep.

**Pass 2 (done, verified, uncommitted 2026-08-07):** removed `@repo/ui` from `apps/shell`. This was a real **Tailwind v3→v4** migration — Shell mirrored the working platform/core template (postcss `@tailwindcss/postcss`, deleted `tailwind.config.ts`, `globals.css` imports `@repo/ds` `tokens.css` + `@source` globs, dropped hand-rolled HSL tokens + `ey-brand.css`). Primitives (Button/Input/Label/cn) → `@repo/ds`. `TopLoader` (app infra, no ds equivalent) → copied core's zero-dep `page-progress-bar.tsx`. Dead code deleted: `shell-sidebar.tsx` (legacy AppSidebar), `mfe-card.tsx`, `components/index.ts`. Kept light-only (no ThemeProvider added). Deleted stale `Frontend/SIDEBAR_INTEGRATION.md`. Rendered QA via repo's installed Playwright (system Chrome / cached chromium) confirmed sign-in, Shell→Core/Platform routing, tokens, loading, 404 all clean.

**Still on `@repo/ui` (intentionally, out of scope):** interns' modules — recruitment, learning, onboarding, interview. `@repo/ui` package itself remains intact.

Key gotcha: shell `dev` script has a `wait-on tcp:3001..3007` gate — to run shell alone, launch `next dev --port 3000` directly (bypass the gate) when other MFE ports are down. See [[next-dev-build-output-split]], [[rendered-verification-playwright]].
