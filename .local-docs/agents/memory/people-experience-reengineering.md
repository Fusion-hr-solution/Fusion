---
name: people-experience-reengineering
description: "Full UI/product rebuild of the /core/people family (roster, profile, temporal, tasks) on unchanged temporal-workforce domain; COMMITTED + ARCHIVED 2026-08-20."
metadata: 
  node_type: memory
  type: project
  originSessionId: aea45528-d98a-41ab-ad46-ac7117133301
  modified: 2026-08-20T05:48:41.538Z
---

People Experience Reengineering — master-prompt pass (`claude-people-experience-reengineering-master-prompt.md`), executed 2026-08-18. Rebuilt the user-facing People product on top of the already-accepted [[temporal-workforce-maintenance]] domain (no model/behavior change).

**OpenSpec:** `people-experience-reengineering` — **COMMITTED + ARCHIVED 2026-08-20** as `archive/2026-08-20-people-experience-reengineering` (created the `people-experience` spec, +7). Code shipped in the clean-slate commits on `refactor/temp-branch` (`e8108bc6` People/temporal + siblings); not pushed. openspec/ is gitignored. Research synthesis + reset SQL in `.local-docs/core/people-reengineering/` and `.local-docs/reset-tenant10.sql`.

**What was replaced (all in `apps/core/src/features/people/components/`):**
- Profile (`people-profile-workspace.tsx`): identity header (identity + as-of + actions) → one `CurrentState` card (work dominant, reporting/employment anchored) as center of gravity → delta-first Upcoming (collapses empty) → History spine (structural rail, future=amber dot) with reports+access as side context. Killed the dead-canvas + detached-right-card layout.
- Task surfaces: shared `task-shell.tsx` (2-col: inputs + sticky `aside` preview) + `task-fields.tsx` `ConsequencePanel`/`PreviewFact` (Now→After, changed facts weighted, amber/destructive tint). Change Work/Manager/End Employment all use it.
- Roster (`people-workspace.tsx`): collapse-empty Location column, quiet dot-state (not pill/row), de-noised manager, volume-aware pager (≤1 page → quiet count, no chrome).

**Breadcrumb key-leak fix:** `TaskShell` calls `useBreadcrumbLabel(employeeKey, subjectName)` so the name resolves on task routes too (was profile-only → task routes showed raw `E-…` key).

**One backend change:** `PeopleProfileReportDto` gained `JobTitle` (correlated subquery in `PeopleProfile.cs`, no N+1) so direct reports read as people. Mirrored in `@repo/api` core-people.ts.

**Verified:** core FE 218 tests, CoreHR 153 (People/Profile/Workforce, real PG), typecheck+lint+prod build all green; rendered QA all checkpoints light+dark+narrow, zero console errors.

**tenant10 reset:** deleted the duplicate `EMP-0000000x` cohort (caused dup Amina/Karim + a contaminating Sep-1 scheduled change); kept coherent `AST-10xx` 10-person set. Repaired Karim **AST-1004** (`E-F650F315A2DE4466B45BAF51684437A3`) — removed stray future work, reopened current work/manager/employment. Demo employee = Karim AST-1004; login `admin@tenant10.com` / the local password (`FUSION_LOCAL_PASSWORD`) (see [[local-dev-auth]]).
