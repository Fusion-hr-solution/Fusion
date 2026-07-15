## 1. Domain And Persistence

- [x] 1.1 Add explicit planning lock metadata to `PerformanceCycle` and a domain operation that records lock actor/timestamp only after readiness passes.
- [x] 1.2 Add tenant-scoped persistence for participant lock exclusion with required reason, actor, timestamp, and cycle/participant indexes.
- [x] 1.3 Add tenant-scoped persistence for campaign-specific approver reassignment history with previous approver, new approver, reason, actor, timestamp, and cycle/participant indexes.
- [x] 1.4 Add tenant-scoped persistence for lightweight planning reminder history with target, reason/context, actor, timestamp, cycle, optional participant, and optional plan.
- [x] 1.5 Add EF configurations, DbSet entries, migrations, and model snapshot updates for all P1.6 persistence.
- [x] 1.6 Add audit action values and audit writer usage for reminder recorded/triggered, approver reassigned, participant excluded, lock rejected, and planning locked.

## 2. Completion Read Model And Lock Rules

- [x] 2.1 Build the HR planning completion query from frozen participants, objective plans, review events, exclusions, reassignment history, and campaign schedule dates.
- [x] 2.2 Compute participant statuses as Not started, Draft, Submitted, Changes requested, Approved, Excluded, or Blocked using product-language DTO values.
- [x] 2.3 Compute blocker categories for missing effective approver, self-approval, unavailable/inactive approver when detectable, inconsistent plan/review state, and unresolved campaign data.
- [x] 2.4 Compute overdue and reminder-needed indicators only from reliable existing dates: employee submission deadline, manager approval deadline, and expected planning lock date.
- [x] 2.5 Implement lock readiness validation that refuses lock unless every frozen participant is Approved or Excluded with reason and returns grouped remaining-action reasons.
- [x] 2.6 Add a reusable planning-lock guard used by employee objective mutation/resubmission handlers and manager approval/request-changes handlers.

## 3. HR Actions And APIs

- [x] 3.1 Add Performance API endpoints/handlers for campaign completion summary and participant list/detail, including paging/filtering by status, blocker, overdue, reminder-needed, and approver.
- [x] 3.2 Add endpoint/handler to record or trigger a reminder action, with optional lightweight `PerformanceNotification` integration only if it fits existing infrastructure without platform expansion.
- [x] 3.3 Add endpoint/handler to reassign a participant reviewer for the campaign with required reason, valid tenant employee target, preserved original approver traceability, and pending-review reassignment.
- [x] 3.4 Add endpoint/handler to exclude a participant from the lock requirement with required reason without deleting participants, objectives, plans, or review history.
- [x] 3.5 Add endpoint/handler to lock planning with confirmation intent, optimistic concurrency, readiness re-check, audit, and immutable lock metadata.
- [x] 3.6 Ensure all P1.6 reads are non-mutating and all writes preserve user input on validation failure.

## 4. Authorization, Tenancy, And Contracts

- [x] 4.1 Enforce deny-by-default tenant-scoped authorization: view completion via campaign view/manage, resolve blockers and reminders via campaign manage, lock via campaign publish/operate.
- [x] 4.2 Ensure cross-tenant campaigns, participants, plans, reminders, reassignment targets, and exclusion targets do not leak data or mutate state.
- [x] 4.3 Update `@repo/api` Performance DTOs, request payloads, response contracts, paths, and query keys for P1.6 completion, reminder, reassignment, exclusion, and lock APIs.
- [x] 4.4 Update `@repo/auth` only if route visibility needs a dedicated helper; otherwise reuse campaign access helpers without new permission sprawl.
- [x] 4.5 Update permission catalog labels/help text only if existing campaign permission wording is insufficient for planning lock operation.

## 5. Existing P1 Flow Integration

- [x] 5.1 Update employee objective create/edit/delete/submit/resubmit handlers to reject normal P1 mutations after planning lock.
- [x] 5.2 Update My objectives UI states so locked approved plans are read-only baselines and locked unresolved states do not show edit/resubmit controls.
- [x] 5.3 Update plan approval queries and action guards to resolve the effective reviewer from latest P1.6 reassignment, falling back to the frozen P1.2 approver.
- [x] 5.4 Update manager approve/request-changes handlers and Plan approvals UI to reject and hide actions after planning lock while preserving read-only review history.
- [x] 5.5 Preserve P1.5 plan-level approval semantics; do not introduce HR force approval or objective-by-objective approval.

## 6. HR Planning Completion Frontend

- [x] 6.1 Add the HR planning completion route anchored under the campaign workspace with sidebar/breadcrumb behavior distinct from My objectives, Team objectives, and Plan approvals.
- [x] 6.2 Build the campaign completion overview using `@repo/ds` and existing app-shell patterns: lock readiness, approved/excluded/remaining counts, and concise action groups.
- [x] 6.3 Build participant monitoring with grouped queue/list, filters, status treatment, overdue/reminder-needed indicators, effective reviewer, frozen approver traceability, and last activity.
- [x] 6.4 Build participant detail with plan status, blocker details, reminder history, exclusion reason, reassignment history, and only the valid HR actions for the current state.
- [x] 6.5 Build reminder, reassignment, exclusion, and lock confirmation interactions with required reason/comment validation, loading/error/success states, and no explanatory clutter.
- [x] 6.6 Cover loading, empty/not-launched, permission-denied, recoverable-error, blocked, actionable, ready-to-lock, and locked read-only states.
- [x] 6.7 Verify responsive desktop/mobile layouts and light/dark contrast; avoid nested cards, duplicated status labels, horizontal overflow, and text clipping.

## 7. Backend Tests

- [x] 7.1 Add domain tests for lock metadata, readiness validation, participant exclusion, required reasons, reassignment history, reminder history, and locked immutability.
- [x] 7.2 Add handler/controller tests for completion status grouping, blockers, overdue indicators, reminders, reassignment, exclusion, lock success, and lock refusal.
- [x] 7.3 Add authorization and tenancy tests for all P1.6 endpoints, including cross-tenant denial and insufficient permission denial.
- [x] 7.4 Add regression tests proving P1.2 frozen baseline is not rewritten by P1.6 exclusion or reassignment.
- [x] 7.5 Add regression tests proving P1.4 resubmission validation still uses frozen planning rules before lock and is blocked after lock.
- [x] 7.6 Add regression tests proving P1.5 approve/request-changes remain plan-level only and are blocked after lock.

## 8. Frontend Tests

- [x] 8.1 Add `@repo/api` contract tests for new P1.6 DTOs, paths, and query keys.
- [x] 8.2 Add `@repo/auth` tests if a new planning completion access helper is added.
- [x] 8.3 Add Performance navigation and breadcrumb tests for the campaign planning completion route and workspace separation.
- [x] 8.4 Add component tests for completion overview, participant grouping/filtering, detail state, reminder action, reassignment action, exclusion action, lock confirmation, and locked read-only state.
- [x] 8.5 Add regression tests for My objectives and Plan approvals locked-state UI behavior.

## 9. Verification And OpenSpec Closeout

- [x] 9.1 Run `openspec validate performance-p1-6-hr-completion-monitoring-planning-lock --strict`.
- [x] 9.2 Run `dotnet test Backend\EY.HRPlatform.Performance.Tests --no-restore`.
- [x] 9.3 Run `dotnet ef migrations has-pending-model-changes --project Backend\EY.HRPlatform.Performance --startup-project Backend\EY.HRPlatform.Performance`.
- [x] 9.4 Run `pnpm --filter @repo/api test`, `pnpm --filter @repo/auth test`, `pnpm --filter performance test`, `pnpm --filter performance type-check`, and `pnpm --filter performance lint`.
- [x] 9.5 Start required local services and verify rendered UI through the shell on `:3000` for HR completion happy path, blocked state, reminder/reassignment/exclusion dialogs, ready-to-lock, locked read-only, permission denied, mobile, desktop, light mode, and dark mode.
- [x] 9.6 Run a final UI/UX audit loop against Fusion design-system rules and remove any temporary Playwright/artifact files before implementation closeout.
- [x] 9.7 Update P1 umbrella notes after implementation, then archive the OpenSpec change only after strict validation and implementation verification pass.
