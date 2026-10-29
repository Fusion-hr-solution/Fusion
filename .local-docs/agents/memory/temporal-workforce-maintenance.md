---
name: temporal-workforce-maintenance
description: "Temporal Workforce Maintenance CoreHR slice — as-of profile, upcoming, timeline, Change Work/Manager/End-Employment; COMMITTED + ARCHIVED 2026-08-20."
metadata: 
  node_type: memory
  type: project
  originSessionId: aea45528-d98a-41ab-ad46-ac7117133301
  modified: 2026-08-20T05:48:26.930Z
---

**COMMITTED + ARCHIVED 2026-08-20.** Landed in the clean-slate pass on `refactor/temp-branch` (not pushed): its code shipped inside commits `10d9b7eb` (workforce import) + `e8108bc6` (People/temporal) + `07aa2c07` (chore). OpenSpec archived as `archive/2026-08-20-temporal-workforce-maintenance` (tasks marked 31/31; its `people-workspace` MODIFIED header was retargeted from "…without a roster As-of scope" to the current "…without As-of scope" that [[people-experience-reengineering]] had renamed, so the archive applied). openspec/ is gitignored → not in git.

Temporal Workforce Maintenance slice (built 2026-08-18). Turns the existing canonical temporal backend into a product over `Employee→Employment→WorkAssignment→ManagerRelationship`. Builds on [[workforce-people-establishment-slice1]].

**OpenSpec** `openspec/changes/temporal-workforce-maintenance` — strict-valid (proposal/design+research/specs/tasks). New cap `temporal-workforce-maintenance`; MODIFIED `employee-lifecycle-actions` (Change Manager gains No-manager; new non-blocking End Employment) + `people-workspace` (profile gains as-of/upcoming/timeline; removed the Slice-1 "no Timeline/Upcoming" + "as-of absent" prohibitions).

**Backend** (all in `Features/People` + `Features/Workforce/Services/WorkforceMutationService.cs`): added `RemovePrimaryManagerAsync` (No-manager), `EndEmploymentReleasingReportsAsync` (boundary = lastEmployed+1 day; releases direct reports managerless instead of blocking — distinct from the existing blocking `TerminateEmployeeAsync`), `PreviewEndEmploymentAsync`. `PeopleProfileQuery` gained `AsOf`; `PeopleTimelineComposer`+`PeopleTimelineQuery` derive Upcoming+Timeline from canonical rows (no fabrication). New employeeKey-keyed endpoints on `EmployeesController`: `GET people/{key}?asOf=`, `/timeline`, `/end-employment/preview`, `POST /change-work` (past-date guard `WorkAssignment.PastDatedChange`), `/change-manager`, `/end-employment`. **Bug found+fixed:** profile manager query was tied to `SubjectWorkAssignmentId` → manager dropped after a Change Work; now resolves by employee+date (matching `WorkforceCanonicalResolver`). Added `Guid? OrgUnitId` to `PeopleWorkDto` (profile sets it, roster passes null) for change-work prefill.

**Frontend** (`apps/core/src/features/people/`): redesigned `people-profile-workspace.tsx` (identity header, Current work, Upcoming, Direct reports, subordinate Timeline, Today/As-of control, contextual Change work/Change manager/More→End actions, read-only on as-of). New routable tasks `people/[employeeKey]/{change-work,change-manager,end-employment}` + workspaces. Shared `workforce-pickers.tsx` (Organization/Manager pickers extracted — establishment still has its own identical local copy; dedup is a minor follow-up). `task-shell.tsx`, `task-fields.tsx`. API: `core-people.ts` extended (asOf, timeline/upcoming DTOs, maintenance transports); hooks in `use-people.ts` (mutation pending flag is `isLoading`, not isPending).

**Verified:** CoreHR builds; 2 new relational proofs pass real PG (`TemporalWorkforceMaintenanceRelationalTests`) + People suite green; core typecheck + lint clean; 10 profile unit tests pass. Rendered QA through shell (light+dark, 0 console errors): profile, Change Work (prefill + current→resulting + scheduling → Today unchanged + Upcoming appears), as-of view (read-only, Return to Today), change-manager/end-employment routes render.

**Demo seed (tenant10, `admin@tenant10.com`/the local password (`FUSION_LOCAL_PASSWORD`), org "Asteria Group"):** primary = **Karim Zayed** `E-5BD2D941BE284CF19ED233BF99BABE71` (Consultant Senior, Digital Foundations, manager Amina, since Feb 2021, clean/no scheduled changes; timeline = 2021 Employment started + Aug-2026 work established). Manager = **Amina Mansour** `E-5313A26D8FAF4E97AAAFE6E9CA5F1606` (Customer Growth; has Karim as report → End-Employment-managerless demo; NOTE she carries a leftover scheduled Sep-1 title change from QA). Stack was left running; **CoreHR (5301) was restarted in-session via `dotnet run --no-build --project EY.HRPlatform.CoreHR` (ASPNETCORE_ENVIRONMENT=Development)** — if down, restart it.
