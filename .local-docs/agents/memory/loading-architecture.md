---
name: loading-architecture
description: Core/Performance MFE loading model — app-shell frame renders unconditionally; loading only ever happens inside the content area; fail-closed via guard + inert pending nav
metadata: 
  node_type: memory
  type: project
  originSessionId: f3b172c2-b066-416b-a43c-779b9408966c
---

Established 2026-07-05 (5 commits d275be7c..af61c93d on the core loading rework):

- **Frame is never gated.** `CorePagesShell` renders `AppShell` unconditionally (Performance shape). The old whole-shell skeleton (`CoreShellLoadingState`) is deleted — do not reintroduce shell-level loading gates; SSR first paint and hydration must be identical.
- **Loading lives in the content area only**, and every surface shows the route's OWN skeleton: `core/src/shell/route-skeletons.tsx` is the registry (`getRoutePageSkeleton(path)`) — canonical per-route skeleton components used by (1) `(pages)/loading.tsx` (client, `usePathname` → target route's skeleton during transitions — verified at runtime that pathname reflects the TARGET during the loading boundary), (2) `CoreSetupRouteGuard`'s fail-closed hold, and (3) the pages' own loading branches (definitions moved out of feature files; re-exports kept for compat). Result: ONE skeleton identity from first paint to content, never generic→dedicated. `@repo/ds` `PageSkeleton` is only the fallback for unregistered routes. Root `app/loading.tsx` = quiet cold-boot spinner only. Keep the registry light (ds/ui imports only — it loads with the route boundary).
- **Sidebar covers unknown state itself**: `pending` props on `ModuleSidebar` (skeleton nav rows), `ShellUserPanel` (chip skeleton, prevents "Sign in" flash), and `ShellNavItem` (looks enabled, inert — never flashes enabled→locked). Wired from `isAuthLoading` / `isAccessResolving` in `core-sidebar.tsx`.
- **`isShellLoading` was renamed `isAccessResolving`** in `setup-access.tsx`; guard renders setup-area paths immediately, holds all other routes on `PageSkeleton` until access is known (fail closed — old code had a fail-open window while the setup query was in flight).
- **Hydration rule:** no sync `localStorage`/`sessionStorage` reads in `useState` initializers under the frame (tenant provider was the offender). No `suppressHydrationWarning` anywhere.
- **Query caching:** core+performance opt into `staleTime: 30s` via `ApiQueryProvider queryClientConfig` (the shared `@repo/api` default stays 0 — [[project-overview]] colleagues' MFEs unaffected). `useSetupState` = 5min (safe: mutations write back via `setQueryData`).
- **Page-skeleton rule:** a page's loading state shows its real static `PageHeader` title + content-shaped blocks; only truly state-dependent titles (draft-structure) stay skeleton, matching `PageHeader` geometry.

**Why:** the "wrong skeleton flash" bug was architectural — SSR's first paint WAS a fake-sidebar skeleton because the whole frame waited on auth + a `useSetupState` network round-trip; deleting a route `loading.tsx` alone made navigation bubble to the full-screen root spinner (worse). Full audit + plan lived in `~/.claude/plans/instead-of-guessing-can-dapper-brook.md`.

**Performance MFE parity gap (2026-07-18).** Performance does NOT yet have the route-skeleton registry. Its `(pages)/loading.tsx` is the *standing* Suspense boundary that flashes during sibling SPA nav (the target segment's own `loading.tsx` only mounts WITH that subtree, so it can't preempt). As a mitigation it was reshaped from thin table rows to **neutral card panels** (card-family, so no more table→cards jump) + per-segment `loading.tsx` files added for the campaigns list/detail/completion (help hard-load & deep-nav only). This is weaker than Core's client-`usePathname()`→registry pattern, which eliminates the flash entirely. **Follow-up:** port `core/src/shell/route-skeletons.tsx` + the client loading boundary to `apps/performance` for full flash-free parity. Also: door-list skeletons now use the shared `@repo/ds/shell` `PageListSkeleton` (fixed lead-card+rows, never seed-sized); campaigns list is lifecycle-grouped cards, not a table.
