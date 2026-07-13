## Why

P1.4 lets employees author and submit a weighted objective plan, then freezes it read-only "awaiting manager review" — but no one can act on it. P1.5 closes that loop: the frozen approver (manager) reviews the submitted plan as a whole and either approves it as the campaign planning baseline or returns it for correction. This is the manager-validation step V0 places between employee objective creation and HR planning lock, and it is the last thing standing between a submitted plan and the approved, auditable baseline P1.6 needs before it can lock.

## What Changes

- **Extend the employee objective plan lifecycle** from `Draft → Submitted` to `Draft → Submitted → Approved`, with a correction loop `Submitted → Changes requested → (employee edits) → Submitted`. Approval is **plan-level**, never objective-by-objective.
- **Add a manager "Plan approvals" workspace** (new top-level sidebar door, distinct from `Team objectives` and `My objectives`): a queue of submitted plans assigned to the signed-in manager through the **frozen P1.2 approver baseline** (never live Core reporting lines), grouped as Waiting for review / Changes requested / Approved, plus a full plan-review detail surface.
- **Two manager actions**: *Approve plan* (records approver + timestamp, makes the plan read-only, terminal in P1.5 — no un-approve) and *Request changes* (requires a comment, moves the plan to `Changes requested`, reopens it for employee correction).
- **Reopen the employee "My objectives" workspace for correction** when changes are requested: the employee edits/adds/deletes objectives, reads the manager's comment, and resubmits. **Resubmission re-runs the full P1.4 submission validation** against the campaign's frozen planning rules.
- **Add an append-only plan review history**: submission, change-request (with comment), resubmission, and approval events, each capturing actor, timestamp, decision, and comment where applicable — a simple chronological log, not a discussion thread.
- **Reuse and re-describe** the existing catalog permission `performance.objective.team.approve` as *"Approve employee objective plans"* (removing the dead Packet A "collective objective" wording); effective authorization stays stricter than the permission — permission **and** frozen-approver assignment for the target participant.
- **Guard self-approval**: a manager can never approve their own plan through the queue; a frozen baseline that names an employee as their own approver is surfaced/blocked as a data issue.
- **Audit** approval, change-request, and resubmission as first-class events; keep manager-as-employee separation (approvals is manager-role work; My objectives stays employee-role work).

Non-goals (explicitly deferred to P1.6+): HR monitoring dashboard and status counts, reminders, escalation, approver reassignment, HR force-validation, planning lock, un-approve/reopen of an approved plan, progress tracking, evaluation, ratings, and 360/peer feedback.

## Capabilities

### New Capabilities
- `performance-plan-approval`: the manager review-and-approval capability — the frozen-approver queue, the plan-review detail, plan-level approve, request-changes-with-comment, plan review history, self-approval guard, and the approve permission and tenancy/audit rules that govern them.

### Modified Capabilities
- `performance-employee-objective-plan`: lifecycle extended to `Approved` and `Changes requested`; a submitted plan is no longer terminally read-only — it becomes editable again after changes are requested and revalidates on resubmission; an approved plan is read-only; the "awaiting review" and "no withdraw" requirements are updated to reflect the new correction loop and manager-review handoff.
- `performance-navigation`: add the manager `Plan approvals` sidebar door (permission + employee-link gated), its `/performance/plan-approvals` and `/performance/plan-approvals/{slug}` routes, and breadcrumbs (`Plan approvals` → campaign name), distinct from `Team objectives`; extend the `My objectives` workspace states to include *changes requested* (editable, with manager comment) and *approved* (read-only).

## Impact

- **Backend (`EY.HRPlatform.Performance`)**: `PlanStatus` enum (+`ChangesRequested`, +`Approved`); `EmployeeObjectivePlan` aggregate (approve/request-changes/resubmit transitions, editability now Draft **or** Changes requested, review-history child collection); new plan-review-event entity + EF configuration + migration; new `PlanApprovals` feature slice (queue + detail queries, approve + request-changes commands) and controller; extend `EmployeeObjectives` submit path for resubmission; `PerformanceCycleAuditAction` (+ approval/change-request/resubmission actions); `PerformanceAccessPolicyService` (+`CanApproveEmployeePlans`). Reuses the frozen `PerformanceCycleParticipant.ApproverEmployeeId` baseline and existing If-Match/optimistic-concurrency and audit conventions.
- **Shared kernel (`CorePermissionCatalog`)**: re-describe `performance.objective.team.approve`; no new permission key.
- **Frontend (`apps/performance`)**: new `plan-approvals` route + `[slug]` workspace and components; extend `my-objectives` workspace for the correction/approved states; sidebar, breadcrumb, and terminology-source updates. `@repo/auth`: add `objectiveTeamApprove` permission constant + `canAccessPlanApprovals` door helper.
- **Tenancy/authorization**: all operations tenant-scoped, deny-by-default; approval limited to the frozen approver of the target participant; cross-tenant targets answer not-found.
- **No Core HR ownership change**: Performance continues to reference Core people only through the frozen launch snapshot.
