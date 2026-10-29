---
name: perf-org-objective-publication
description: Performance org-objective approval workflow superseded by Draft→Published (no parent approval)
metadata: 
  node_type: memory
  type: project
  originSessionId: 7d8dfb42-ab88-40ba-b93b-33e067c29a5d
  modified: 2026-08-31T18:12:49.051Z
---

Business-decision change (2026-08-31, uncommitted) superseding the locked org-objective approval model in [[perf-cycle-goals-chunks-bcd]] / [[perf-cycle-goals-proposed]].

**Old:** organizational objective lifecycle `Draft → Submitted → Approved`; the aligned parent's accountable person approved/returned; `ObjectiveDecision` trail; no tenant-admin override.

**New:** `Draft → Published`. The authorized scope owner (the objective's own accountable person, or `cycle.manage @Tenant`) publishes it as official direction — **no routine parent approval**, no Submitted/Approved/Returned state, no decision queue. Only a **Published** org objective is a downstream alignment baseline. Employee-plan Draft→Submitted→Approved&Locked is unchanged (real agreement). Calculated-parent contribution config stays the parent's own responsibility (not child approval). Alignment ≠ contribution preserved.

**Why:** delegated scope authorization *is* the governance boundary; mandatory parent approval creates an avoidable upstream approval ladder and weakens delegated accountability; simple alignment does not rewrite/determine the parent.

**How to apply / blast radius (all done + verified, uncommitted):**
- Domain `Objective`: removed `Submit/Approve/Return`, `_decisions`, `ApprovedAt`; generalized `Publish()` to Company+OrgUnit; `IsAlignmentBaseline` = Published only; deleted `ObjectiveDecision` + `ObjectiveDecisionKind`. Migration `RemoveOrganizationalObjectiveApproval` drops `ObjectiveDecisions`/`ApprovedAt` + normalizes old rows (Approved→Published, Submitted→Draft).
- App/API: `PublishObjectiveCommand/Handler` replaces submit/approve/return; `POST goals/{id}/publish`. Downstream OrgUnit `State==Approved` → `Published` in `PlansComposer`, `ProgressComposer`; contribution-lock child readiness now requires Published.
- **Authorization reworked (2nd pass, same session) — see [[perf-org-objective-scope-authority]]**: create/edit/publish authority is now organizational-scope management, NOT parent-accountable and NOT this-objective's-accountable-person. New capability `performance.objective.org.manage @OrgUnit` (5th perf permission, seeded to Manager profile); `@OrgUnit` resolved concretely to the caller's own workforce unit + descendants via the snapshot. Publish = scope authority only (reassigning accountable never removes scope manager's publish); edit also accepts accountable as maintenance. `GoalActorContext` now `(CallerEmployeeId, IsAdmin, HasOrgManageGrant)`; `OrgScopeAuthority` resolver in `GoalsComposer`. `CanCreateUnder` removed.
- Contracts/FE: `@repo/api` enum `Draft|Published`; `GoalDetailDto.canPublish` (dropped history/canDecide/canSubmit); `GoalsOverviewDto.publishedCount`; removed `ObjectiveDecisionDto`/`ReturnObjectiveRequest`. `objective-context-panel` publishes (removed DecisionBlock/AwaitingDecision/HistoryTimeline); composer defaults Accountable to signed-in user when they're a valid selectable person (guarded — skipped for admins with no employeeId).
- Reconciled OpenSpec `establish-performance-cycle-and-goals` (org-goals/authorization/proposal/design/tasks — strict-valid) + local product-spec §14/§16/§17 + ui-ux-spec §17.
- Gates: CoreHR/Perf backend 51/51 (1 relational skipped); FE api 112 + perf 9; type-check/lint/prod build clean; rendered on tenant10 FY2026 (both prior Approved org objectives now show Published; no approval UI anywhere; 0 console errors).
- Do NOT redesign Overview (pinned). Stopped+restarted Performance dev service (port 5401) to build/test; AutoMigrate applied the drop-table migration.
