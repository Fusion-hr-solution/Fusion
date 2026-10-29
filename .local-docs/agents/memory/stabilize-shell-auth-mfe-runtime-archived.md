---
name: stabilize-shell-auth-mfe-runtime-archived
description: "Shell/auth/MFE runtime stabilization OpenSpec change — DONE, specs synced, archived 2026-08-21"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5cef8bdf-3e55-4c56-8a82-9930bee1e547
  modified: 2026-08-21T05:03:20.272Z
---

OpenSpec change `stabilize-shell-auth-mfe-runtime` **completed, verified, spec-synced, and archived 2026-08-21** → `openspec/changes/archive/2026-08-21-stabilize-shell-auth-mfe-runtime`. All 82 tasks done, strict-valid.

**What it delivered** (the runtime hardening behind [[loading-architecture]]): hydration-safe SSR/client parity for authenticated Core+Performance workspaces; ONE shared workspace-access mechanism in `@repo/auth` (`use-hydrated-workspace-access.ts` + `customer-workspace-access.ts`) consumed by both MFEs (no per-MFE drift); unconditional frame with loading confined to content, failing closed while auth unresolved; volatility-appropriate `@repo/api` cache defaults + 5-class error normalization (`error-classification.ts`) + class-aware bounded retry; explicit shell `/api/[...path]/route.ts` proxy replacing the implicit rewrite (attributed 503 for upstream-unreachable, full successful-proxy parity incl. 204/multipart/streaming/ETag/cancellation); document-proxy no longer surfaces a compiling MFE as a bare 500; frame-preserving "temporarily unavailable" recovery; dev upstream-availability legibility.

**Sync:** created 4 NEW main specs (were absent) — `authenticated-workspace-runtime` (5 reqs), `frontend-loading-and-revalidation` (3), `frontend-navigation-continuity` (3), `frontend-upstream-failure-handling` (7); all `openspec spec validate --strict` clean.

**Verification at archive:** @repo/auth 96, @repo/api 112, shell 61 (incl. `proxy.test.ts` attributed-503 + parity) all green. Uncommitted; `openspec/` is gitignored local-only. Remaining active change: `establish-performance-cycle-and-goals`.
