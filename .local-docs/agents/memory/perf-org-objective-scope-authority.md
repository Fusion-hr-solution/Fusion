---
name: perf-org-objective-scope-authority
description: "Org-objective create/edit/publish gated by NEW objective.org.manage @Tenant (coarse MVP), not accountability/parent; per-OrgUnit deferred"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7d8dfb42-ab88-40ba-b93b-33e067c29a5d
  modified: 2026-08-31T18:38:46.943Z
---

Authorization seam resolved (2026-08-31, uncommitted) after [[perf-org-objective-publication]] removed org approval. **New dedicated capability `performance.objective.org.manage`** (5th perf permission), superseding the module's earlier "no new permission" line.

**Finding (why a new permission was needed):** a JWT permission grant is only `{key, scope-breadth}` — `GetCorePermissions` collapses each key to its single widest breadth; there is NO concrete OrgUnit id in claims. The workforce snapshot exposes an employee's own OrgUnit + their manager, not "units they lead"; Core has no OrgUnit-leader field. So per-OrgUnit management authority is **not expressible in the current Access model**.

**FINAL MVP decision (user, after a first OrgUnit-scoped pass): coarse `@Tenant`.** An earlier implementation resolved `@OrgUnit` concretely (caller's own workforce unit + descendants via the snapshot); the user then simplified the MVP boundary and had me **remove all that machinery** (OrgScopeAuthority / ResolveScopeAuthorityAsync / CanManageScope, own-unit anchoring, subtree resolution, the snapshot reads + `FakeCoreWorkforceClient.OrgParents` added for it, cross-OrgUnit denial). Fine-grained per-OrgUnit management scope (concrete assignment, descendants, multiple scopes, HRBP/custom profiles, management UX) is **deferred to the future tenant Access/Profile design**. No dormant per-OrgUnit infra left.

**Model (coarse):** org-objective create/edit/publish requires **organizational-objective management authority** = `cycle.manage @Tenant` (admin) OR `objective.org.manage @Tenant`. Holder may manage org objectives **anywhere in the tenant**. NOT from `cycle.view` (visibility != write), NOT membership, NOT manager-of, NOT parent-accountability, NOT this-objective's accountable person. **Publish = management authority only** -> reassigning Accountable never removes it. **Edit** also accepts the objective's accountable person as maintenance. Accountable defaults to signed-in user in composer (editable).

**Touch points:** `PerformancePermissions.ObjectiveOrgManage` + catalogue def AllowedScopes `[Tenant]` (SharedKernel — so Tenant Admin builder now auto-includes it too); `PerformanceAccessPolicyService.CanManageOrganizationalObjectives` (checks @Tenant); seeded `@Tenant` on **Manager** profile in `AccessProfileTemplates.PerformanceGrantsByInternalKey`. `GoalActorContext(CallerEmployeeId, IsAdmin, HasOrgManageGrant)`; simple `GoalsComposer.CanManageOrganizational(actor)` = `IsAdmin || HasOrgManageGrant` + `CanMaintain(actor, objective)` = that OR accountable; handlers use `command.Actor` directly (no async authority resolve). `PerformanceAccessDto.CanManageOrgObjectives` + client twin (`hasCorePermission(..., "Tenant")`); `goals/page.tsx` create affordance = `canAdminister || canManageOrgObjectives`.

**Proof (`OrganizationalGoalsTests`, 56 perf tests green):** manager(grant) create; manager publish; **manager manages another OrgUnit too (coarse, expected)**; **reassign Accountable -> manager still edits/publishes** + new accountable (no grant) denied; employee without grant denied create; view-only denied publish; governed admin authorized; (employee-plan authz untouched — separate suites).

**Gates:** perf backend 56 (1 relational skipped), Identity 266, FE api 112 + perf 9, type-check/lint/prod build clean, OpenSpec strict-valid (org-goals + authorization + design + tasks reconciled; catalogue now 5; explicit defer documented). **Not committed.**

**Demo caveat:** a rendered non-admin manager journey needs tenant10 **profile re-seed** (Manager gains `objective.org.manage @Tenant`) + a manager login. Backend authz proven by tests; rendered admin path already verified. Per user, do NOT provision/render the scoped Nour journey.
