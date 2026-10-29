---
name: worker-profile-consolidation
description: "CoreHR profile unified into one shared WorkerProfile surface behind /core/profile (self) and /core/people/{id} (other)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 081a16a4-70ea-4e92-9ba8-e1e1ef17200a
  modified: 2026-09-16T18:19:23.113Z
---

Reconciled the two divergent CoreHR profile products into **one shared surface**, 2026-09-16 (uncommitted, branch `wassim/develop`).

- **Shared surface:** `features/people/components/worker-profile/worker-profile.tsx` (presentational, capability-driven via slots) + `worker-profile-view.ts` (`WorkerProfileView` model + `fromSelfDetails` / `fromPeopleProfile` adapters). Composition = the polished redesigned self profile, generalized; hosts People's temporal (as-of/upcoming/history) + management chrome via slots.
- **Both routes feed it:** `/core/profile` (self container `app/(pages)/profile/page.tsx`, self-service Edit dialog, no temporal — kept current-state-only per user) and `/core/people/[employeeKey]` (`people-profile-workspace.tsx` container, as-of + Change work/manager/End-employment + work-email). `/core/employees/[id]` stays a redirect to `/people/[id]`.
- **Deleted ~3,400 LOC orphan cluster** (only self-referencing after the earlier redirect migration): `employee-profile-workspace(.test).tsx`, `employee-profile-workspace-sheets.tsx`, `employee-access-management-sheet(.test).tsx`, `employee-reporting-lines-sheet.tsx`, plus the old `my-profile-workspace(.test).tsx`. `features/employees/profile/` is now gone.
- **Page states** distinguished in the People container via `classifyApiError`: 403→forbidden ("You don't have access…"), 404/validation→"Worker not found", transient→retry. Self keeps the distinct "no linked employee" vs error states (workforce existence ≠ account linkage).
- **Fixes made in passing:** the shipped self profile used `/core/...` Link hrefs which double-prefix under core's basePath `/core` (→ `/core/core/...`, broken) — merged surface uses root-relative hrefs. People surface migrated off legacy `@/components/ui/*` onto `@repo/ds`. Removed §33.13 fact repetition (Employment card).
- **Verified:** core type-check + lint (only pre-existing warnings) + 233 tests + prod build green. Rendered via Playwright (Owen Kaya, manager, asteria-group): self profile light/dark/narrow ✓ (narrow hero fixed — actions stack below identity), forbidden state ✓ (manager 403'd on a report — the People-profile endpoint is roster/manage-gated, not team). **Not yet rendered:** the successful other-worker People profile (temporal + full management chrome) — needs a roster/HR-admin login (covered by the 17 People unit tests + identical shared component). See [[local-dev-auth]].
