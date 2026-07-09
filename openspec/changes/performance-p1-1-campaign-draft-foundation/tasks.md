## 1. Scope lock and legacy disposition

- [x] 1.1 Confirm the lean Draft data contract in writing (identity: name, reference year, purpose, owner=creator; schedule: opening/submission/approval/expected-lock; frozen rules snapshot; campaign-scoped strategic objectives) and the single-status `Draft` decision, so no governance/population/activation fields enter the lean surface.
- [x] 1.2 Record the pro-target-first disposition for the campaign aggregate: refit `PerformanceCycle` (no parallel aggregate); list exactly which existing fields/commands are refit vs. left deferred-but-wired, with file paths.
- [x] 1.3 Record the disposition for the generic `StrategicObjective`/`StrategicPeriod` module: superseded, no new P1 UI/nav/extension, wiring untouched; the removal + collective/team repointing is explicitly handed to the P1.3 change. Ensure no new dead/duplicate code is introduced.
- [x] 1.4 Confirm authorization reuse (`CycleManage` for write, `CycleView`/manage for read) or decide on campaign-specific permission keys; confirm no silent permission-catalog additions.

## 2. Backend domain model (refit + campaign-scoped strategy)

- [x] 2.1 Refit the campaign aggregate (`Domain/Entities/PerformanceCycle.cs`) with the lean schedule (planning opening, employee submission deadline, manager approval deadline, expected planning lock), purpose/guidance, and owner reference; enforce required fields, reference-year bounds, and non-decreasing date ordering in the domain factory/mutators.
- [x] 2.2 Add an owned, immutable rules-snapshot value object (max objective count, allowed weight menu, enabled measurement methods) captured at creation; expose it read-only on the aggregate.
- [x] 2.3 Add the campaign-scoped strategic-objective child entity (title required, optional description, optional responsible-function label, active flag) with campaign-bound creation/edit/toggle behavior and length validation.
- [x] 2.4 Add a Draft-completeness evaluation (name, reference year, complete ordered schedule, captured snapshot, ≥1 active strategic objective) that returns blocking reasons and performs no population/activation.

## 3. Backend persistence and migration

- [x] 3.1 Add/adjust EF configuration for the refit campaign fields, the snapshot value object, and the new strategic-objective table (tenant + campaign indexes, tenant isolation, optimistic `Version`).
- [x] 3.2 Create an additive migration for the new columns/table; preserve existing campaign rows and all Packet A tables (no destructive drops); provide a reversible down migration.
- [x] 3.3 Verify no pending model changes after the migration (`dotnet ef migrations has-pending-model-changes` equivalent / build gate) and that `PerformanceDbContextModelSnapshot` is consistent.

## 4. Backend features, API, authorization, and audit

- [x] 4.1 Realign the campaign create/update feature path to the lean Draft contract (create in `Draft`, edit identity + schedule) with the shared Apply/validation result shape (validation reasons vs. 409 concurrency vs. transport error), copying the tenant objective-planning config into the snapshot at creation and blocking creation when no tenant configuration is applied.
- [x] 4.2 Add strategic-objective commands/queries (add, edit, toggle active, list) scoped to a campaign in the acting tenant.
- [x] 4.3 Add query/read models for campaign list, campaign Draft detail (including read-only snapshot and objectives), and completeness; guarantee reads perform no writes.
- [x] 4.4 Wire controller endpoints and DTOs using product-oriented shapes; enforce deny-by-default authorization via `PerformanceAccessPolicyService` and tenant isolation via the existing interceptor/query filters.
- [x] 4.5 Emit audit facts (actor, timestamp, changed facts) for creation and meaningful changes (identity, schedule, snapshot capture, strategic-objective add/edit/toggle) via the existing Performance audit mechanism.

## 5. Backend tests

- [x] 5.1 Domain tests: identity/schedule validation, date ordering, snapshot immutability, strategic-objective rules, and completeness reasons.
- [x] 5.2 Feature/integration tests: create/edit Draft, snapshot copied at creation and unaffected by later tenant-config changes, strategic-objective lifecycle, and completeness handoff.
- [x] 5.3 Authorization + tenant-isolation tests: unpermitted create/edit denied, view-only read, cross-tenant read/write denied, no-mutation-on-read.
- [x] 5.4 Concurrency test: stale-token edit rejected as conflict distinct from validation, with no partial apply.
- [x] 5.5 Run backend build + tests green (`dotnet build`, `dotnet test`) and confirm no unintended contract regressions in existing Cycle tests.

## 6. Frontend data and API layer

- [x] 6.1 Add campaign types and `@repo/api` query/mutation hooks (list, get Draft, create, update identity/schedule, strategic-objective add/edit/toggle) with the shared apply-result/error handling (validation vs. conflict vs. retryable vs. permission-denied).
- [x] 6.2 Add campaign terminology/labels in the app's single terminology source (no backend field names, no "cycle"/enum leakage; product term is "campaign").

## 7. Frontend Campaigns workspace UI

- [x] 7.1 Add routes `/campaigns` (list + truthful empty state), `/campaigns/new` (create), `/campaigns/[id]` (Draft workspace) under `apps/performance`, permission-gated.
- [x] 7.2 Build the campaign list (with empty state) and the create flow using `@repo/ds` components; reference year as a select; concise labels; no decorative helper text.
- [x] 7.3 Build the Draft workspace as a sectioned, inline-editable surface — Identity, Planning schedule, Planning rules (read-only snapshot), Strategic objectives (inline editable list with active toggle) — grouped by intent, with inline date-ordering validation and no redundant read/edit split.
- [x] 7.4 Implement all truthful UI states: loading skeleton, empty, validation-blocked, dirty-state, save-success without manual refresh, stale-concurrency conflict, retryable error, and permission-denied/read-only.
- [x] 7.5 Add the `Campaigns` sidebar entry (`src/data/sidebar-nav.ts`) gated on campaign view/manage permission, and breadcrumb entries for list, `New campaign`, and the Draft workspace.

## 8. Frontend tests

- [x] 8.1 Component/interaction tests for the Draft workspace: validation messages, date-ordering guard, dirty-state, save-success, conflict, and read-only for view-only users.
- [x] 8.2 Navigation/breadcrumb tests: `Campaigns` visibility by permission, route rendering, and breadcrumb hierarchy (extend existing performance-sidebar/breadcrumb tests).

## 9. Verification gates

- [x] 9.1 Frontend `pnpm --filter performance test`, `pnpm lint`, and `pnpm type-check` pass.
- [x] 9.2 Backend build + tests pass and the migration applies cleanly on a fresh database with no pending model changes.
- [ ] 9.3 Rendered UI/browser verification of the real Campaigns experience: create a Draft, edit schedule (valid + invalid ordering), view read-only snapshot, add/edit/toggle strategic objectives, and observe empty/loading/conflict/permission-denied states — inspected in-browser, not only compiled/tested.
- [ ] 9.4 Confirm the frontend quality matches the backend for this capability and re-check proposal/design/specs against the built result; update artifacts if scope shifted, then run `/opsx:verify`.
