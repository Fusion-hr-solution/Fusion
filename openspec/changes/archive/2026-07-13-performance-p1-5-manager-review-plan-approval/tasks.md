## 1. Domain: lifecycle, transitions, review history

- [x] 1.1 Extend `PlanStatus` enum with `ChangesRequested` and `Approved` (keep int backing; Draft=0, Submitted=1, ChangesRequested=2, Approved=3).
- [x] 1.2 Add `EmployeeObjectivePlanReviewEvent` child entity (Id, PlanId, ActorEmployeeId, ActorName, `ReviewEventType` enum {Submitted, ChangesRequested, Resubmitted, Approved}, `Comment?`, `OccurredAt`) and expose it as an append-only read-only collection on `EmployeeObjectivePlan`.
- [x] 1.3 Add approver-decision metadata to the plan (approving manager id/name + approved timestamp; last change-request comment convenience accessor if needed) without duplicating the review-event log.
- [x] 1.4 Replace `EnsureDraft()` mutation gate with `EnsureEditable()` allowing mutation while `Draft` OR `ChangesRequested`; keep `RemoveObjective`/`AddObjective`/`UpdateObjective` on that gate.
- [x] 1.5 Allow `Submit(...)` from `Draft` OR `ChangesRequested`, reusing the existing `ValidateForSubmission` path; on success from `ChangesRequested` record a `Resubmitted` review event (else `Submitted`), refreshing `SubmittedAt` and the frozen approver reference.
- [x] 1.6 Add `RequestChanges(actor, comment, now)` — guard requires `Submitted`, requires non-empty comment, sets status `ChangesRequested`, appends a `ChangesRequested` review event with the comment.
- [x] 1.7 Add `Approve(actor, now, note?)` — guard requires `Submitted`, sets status `Approved`, records approving manager + timestamp, appends an `Approved` review event; approval is terminal (no un-approve method).
- [x] 1.8 Domain unit tests for every transition: edit/submit only from editable states; request-changes/approve only from Submitted; approved terminal; comment required on request-changes; resubmission revalidation; review-event log ordering.

## 2. Persistence & migration

- [x] 2.1 EF configuration for `EmployeeObjectivePlanReviewEvent` (owned/related collection, tenant-scoped via the plan) and any new plan columns; register in `PerformanceDbContext`.
- [x] 2.2 Additive EF Core migration (new table + columns; enum stored as int needs no data change); verify existing Draft/Submitted rows remain valid and `has-pending-model-changes` is clean.

## 3. Authorization & audit

- [x] 3.1 Re-describe `performance.objective.team.approve` in `CorePermissionCatalog` to "Approve employee objective plans" (remove all "collective objective" wording); no key change.
- [x] 3.2 Add `IPerformanceAccessPolicyService.CanApproveEmployeePlans` (capability check on `ObjectiveTeamApprove`); wire default deny.
- [x] 3.3 Add `PerformanceCycleAuditAction` values `EmployeeObjectivePlanApproved`, `EmployeeObjectivePlanChangesRequested`, `EmployeeObjectivePlanResubmitted`.

## 4. Backend feature slice: Plan approvals (manager)

- [x] 4.1 Add a shared approver-scope guard: load participant for `(cycleId, plan.EmployeeId)`, require `ApproverEmployeeId == currentUser.EmployeeId`, reject self-approval (`participant.EmployeeId == currentUser.EmployeeId`), enforce tenant scope, cross-tenant → not found.
- [x] 4.2 `GetMyPlanApprovalCampaigns` query — launched campaigns where the user is a frozen approver of ≥1 participant, with waiting/changes-requested/approved counts (frozen baseline only; empty list when no employee identity).
- [x] 4.3 `GetPlanApprovalWorkspace` query — for a campaign slug: assigned plans grouped by review state with employee, objective count, total weight, submission/resubmission timing; plan-review detail (full objectives + alignment + measurement + review history + prior comment); flag self-approver rows as data issues, not approvable items.
- [x] 4.4 `ApproveObjectivePlan` command — approver-guarded, If-Match concurrency, calls `Approve`, writes audit; maps blocking/permission failures.
- [x] 4.5 `RequestObjectivePlanChanges` command — approver-guarded, requires comment, If-Match, calls `RequestChanges`, writes audit.
- [x] 4.6 `PlanApprovalsController` at `api/performance/plan-approvals` (`GET /my-campaigns`, `GET /campaigns/{slug}`, `POST /campaigns/{cycleId}/plans/{planId}/approve`, `POST /.../request-changes`) using the shared `MapFailure`/If-Match conventions; deny-by-default via `CanApproveEmployeePlans`.
- [x] 4.7 DTOs + mapper for queue, plan-review detail, and review history.

## 5. Backend: employee resubmission path

- [x] 5.1 Confirm/extend the existing `EmployeeObjectives` edit/delete/submit path so it works while `ChangesRequested` (editability now via `EnsureEditable`); ensure submit records the `Resubmitted` event and audits `EmployeeObjectivePlanResubmitted`.
- [x] 5.2 Ensure the employee workspace query returns review status, the manager change-request comment, approved read-only state, and review history for the owning employee.
- [x] 5.3 Backend integration/handler tests: manager approves → plan Approved + audit + history; request-changes without comment rejected; request-changes reopens → employee edits + resubmits → back to Submitted revalidated; non-approver denied; self-approval hidden; cross-tenant not found.

## 6. Frontend: auth + navigation

- [x] 6.1 `@repo/auth`: add `objectiveTeamApprove` permission constant and `canAccessPlanApprovals(user)` = employee-linked AND holds the permission; unit tests (hidden for no-employee-link and no-permission).
- [x] 6.2 Add `PLAN_APPROVALS_NAV` to `data/sidebar-nav` and render it in `performance-sidebar.tsx` gated by `canAccessPlanApprovals`, as a distinct door beside `My objectives` and `Team objectives`; update the single terminology source.
- [x] 6.3 Sidebar test: `Plan approvals` shows for approver with employee link, hidden for admin-with-permission-no-link and for no-permission; three distinct doors for a manager-as-employee.
- [x] 6.4 Breadcrumb: `Plan approvals` → campaign name for `/performance/plan-approvals/{slug}`.

## 7. Frontend: manager approvals workspace

- [x] 7.1 Routes `app/(pages)/plan-approvals` (campaign list / empty state) and `plan-approvals/[slug]` (queue + detail).
- [x] 7.2 API/query hooks in `services`/`hooks` for the four endpoints, with If-Match plumbing and optimistic-concurrency handling.
- [x] 7.3 Queue UI: per-employee review cards grouped Waiting for review / Changes requested / Approved, glanceable-first (employee, objective count, total weight, timing); truthful empty state ("no launched campaign assigns you plans to review"); self-approver rows shown as a flagged data issue.
- [x] 7.4 Plan-review detail: read-only full plan reusing the weight-meter + objective-list visual language (alignment, weight, deadline, measurement detail), review history timeline, prior change-request comment; two actions — Approve plan and Request changes (comment required in a small dialog); no objective editing.
- [x] 7.5 Verify states: loading skeleton (content area only), permission-denied, recoverable error, empty, approved read-only, request-changes validation (empty comment blocked), light/dark, mobile/desktop.

## 8. Frontend: employee correction states

- [x] 8.1 Extend the `my-objectives/[slug]` workspace with the *Changes requested* state: prominent manager-comment banner, plan reopened for editing (reuse the P1.4 objective editor), and a Resubmit action.
- [x] 8.2 Add the *Approved* read-only state to the employee workspace, in product language.
- [x] 8.3 Verify employee states: submitted (awaiting review, read-only), changes requested (editable + comment + resubmit, invalid-resubmit blocked with reasons), approved (read-only); no withdraw action in any state.

## 9. Verification & wiring

- [x] 9.1 Backend `dotnet build` + Performance test suite green; run migration locally and confirm no pending model changes.
- [x] 9.2 Frontend `pnpm type-check`, `pnpm lint`, and `@repo/auth` + performance tests green.
- [x] 9.3 Rendered verification through the shell (`:3000`): manager approves a submitted plan; manager requests changes; employee reads the comment, corrects, and resubmits; manager re-reviews and approves; approved plan read-only for both. Confirm manager-as-employee separation across My objectives / Team objectives / Plan approvals.
- [x] 9.4 Confirm non-goals absent: no HR counts/monitoring, no reminders, no reassignment, no un-approve, no lock, no objective-by-objective approval.
