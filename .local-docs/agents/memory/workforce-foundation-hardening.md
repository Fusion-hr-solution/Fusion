---
name: workforce-foundation-hardening
description: In-progress OpenSpec change rewriting Core HR onto a canonical effective-dated workforce model; resume via /opsx:apply
metadata: 
  node_type: memory
  type: project
  originSessionId: 9b186188-3d3a-4dac-a907-d5da327b8306
---

`core-workforce-foundation-hardening` is a large in-progress OpenSpec change (`openspec/changes/core-workforce-foundation-hardening/`, schema spec-driven, 52 tasks) hardening Core HR onto one canonical, effective-dated workforce model: `Employee -> Employment -> WorkAssignment -> ManagerRelationship`, replacing legacy direct `Employee` fields (`ManagerId`/`OrgUnitId`/`JobTitle`/`WorkLocation`/`HireDate`/`Status`/`EmploymentType`) and the provisional `Position`/`EmployeePositionAssignment`/`EmployeeOrgMembership` entities.

**Resume with `/opsx:apply core-workforce-foundation-hardening`** — progress + per-task decisions live in `tasks.md` checkboxes (the source of truth; don't re-derive from chat).

Done so far — Sections 1–3 complete, 15/52 (verified: build green 0 warnings, 492 CoreHR tests pass, no pending EF model changes):
- Section 1 (1.1–1.7): canonical entities + configs + `EffectiveDateRange` half-open `[from,to)` value object + migration `AddWorkforceCanonicalModel` (additive). Decision: `ManagerRelationship` added alongside legacy `EmployeeReportingRelationship`, which is removed in Phase 3 (task 10.1) to keep build green.
- Section 2 (2.1–2.4): `Infrastructure/Backfill/` per-tenant fail-fast backfill (NOTE: namespace must NOT contain segment `Migration` — collides with EF `Migration` base type).
- 3.1: `WorkforceCanonicalResolver` (as-of read resolvers, AsNoTracking).
- 3.2: `Features/Workforce/Services/WorkforceMutationService` (`IWorkforceMutationService`) — the canonical WRITE layer the endpoints/lifecycle/import (4.x–6.x) compose. UpdateEmployeeProfile / StartEmployment / EndEmployment / ChangeWorkAssignment / ChangeManager. Key design: methods STAGE onto the tracked DbContext (Add/mutate + a `WorkforceAuditEntry` per action) and do NOT call SaveChanges — the orchestrating handler commits once so fact+audit are one transaction and composed-create is atomic. Validate-before-mutate, `Result<T>`+`Error`, Local-first lookups so freshly-staged facts resolve. Added `Employee.UpdateProfile` (identity-only).
- 3.3: `Features/OrgUnits/Services/ResponsibleManagerService` — validates `OrgUnit.ResponsibleManagerEmployeeId` (same-tenant + active canonical Employment) and stages `ResponsibleManagerChanged` audit on change; wired into Create/Update org-unit handlers (their direct-instantiation tests now pass `Rms(context)`). Org-unit mutations already deny-by-default `[Authorize(Roles=HRAdmin)]`.
- 3.4: no `WorkforceAuditEntry` read API exists (writes only) — deferred deny-by-default to avoid dead code; entity already fail-closed tenant-scoped, pinned by `WorkforceAuditTenantIsolationTests`.

Next: **task 4.1** — composed `POST api/corehr/employees` orchestrating Employee+Employment+primary WorkAssignment+optional ManagerRelationship atomically via the 3.2 mutation service (single SaveChanges), returning `EmployeeDetails`. Then 4.2–4.4 (composed PUT, EmployeeDetails read model, tenant-publish org-unit safety check), Section 5 lifecycle actions, Section 6 import. Phase 3 (Section 10) is the destructive column/table drop; backfill against a real Postgres is verification task 11.2. See performance-packet-a (archived) for the dependent Performance module.
