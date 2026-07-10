# Tasks — Objective Planning Population & Launch (P1.2)

Vertical slice: each group ends in something verifiable. Backend, migration, frontend, polished UI, tests, and rendered verification are all in scope. Legend for status shown to users comes from `campaign-terminology.ts` (single source).

## 1. Remove the dead Packet A cycle launch path

- [x] 1.1 Remove the Packet A launch lifecycle from `PerformanceCycle`: delete `AssignmentPreparation`/`ReadyToLaunch` states and `BeginAssignmentPreparation`/`Publish`/`MarkReadyToLaunch`/`Activate`/`ConfigureGovernance`/`RecordResponsibilityChange`, the governance/feedback fields, and the `EnsureGovernanceConfigured` gate.
- [x] 1.2 Delete the dead launch-path entities `CampaignAssignmentResponsibility`, `CampaignExceptionOwner`, `CampaignLaunchParticipantSnapshot` and their EF configurations + `DbSet`s.
- [x] 1.3 Delete the dead `Features/Cycles` commands/queries: `ConfigureGovernance`, `CurateCampaignResponsibility`, `MarkReadyToLaunch`, `ApplyWorkforceDelta`, `PublishCycle`/`ActivateCycle` (two-step), `GetCampaignResponsibilities`/`GetCampaignResponsibilityHistory`, `CampaignWorkforceDeltaResolver`, and cycle-scoped exception endpoints — scoped to the launch path only.
- [x] 1.4 Remove the corresponding `PerformanceCyclesController` actions (governance, responsibilities, ready-to-launch, workforce-delta, publish/activate, cycle exceptions) and any now-dead DTOs.
- [x] 1.5 Delete or rewrite unit/integration tests that reference the removed code; confirm `dotnet build` for `EY.HRPlatform.Performance` is green with the launch path removed. (Out of scope: feedback, formal-review, standalone exception-case, campaign-work-item modules — leave compiling.)

## 2. Lean domain model: population, approver baseline, launch

- [x] 2.1 Add `Launched` to the cycle status enum and `LaunchedAt` to `PerformanceCycle`; keep `Draft` as the only editable state (`IsEditable`).
- [x] 2.2 Add a required `Reason` to `ExcludeEmployee` population rules (`PerformanceCyclePopulationRule`) and adjust `SetPopulation` to require it; all-active remains implicit when no `OrgUnit` scope exists.
- [x] 2.3 Extend the single frozen participant baseline (`PerformanceCycleParticipant`) with `ApproverEmployeeId`, `ApproverName`, `IsApproverOverridden`, `ApproverOverrideReason`.
- [x] 2.4 Add a draft-side approver override store (per participant employee id → overridden approver + reason) usable before launch; edits gated to `Draft`.
- [x] 2.5 Add `PerformanceCycle.Launch(resolvedBaseline, occurredAt)` that requires draft completeness, refuses when a blocking condition is present, freezes one participant record per included employee (with resolved approver), sets status `Launched` + `LaunchedAt`, and is not re-runnable.
- [x] 2.6 Unit-test the aggregate: launch freezes baseline; launch refused on empty population / missing approver / no active strategic objective; default vs overridden approver captured; launched campaign is read-only and cannot relaunch; launch allowed with a future planning opening date.

## 3. Application layer: commands & queries

- [x] 3.1 `SetCampaignPopulation` command — org-unit scopes (with descendants) + exclusions-with-reason; validation preserves entered values; `performance.cycle.manage`; tenant-scoped.
- [x] 3.2 `OverrideParticipantApprover` command — validate target is an active Core employee in the acting tenant via `ICoreWorkforceClient`; store override + reason; audit; `performance.cycle.manage`.
- [x] 3.3 `GetCampaignPopulationPreview` query — live resolve via `PerformancePopulationResolver`; returns included members + excluded (with reasons); read-only; `performance.cycle.view`.
- [x] 3.4 `GetCampaignReadiness` query (lean) — included participants with resolved default/overridden approver, excluded list, and conditions classified blocking vs informational (no overload/delta/exception noise); read-only. If approver Identity/access data is readily available, include approver access/account issues as **informational** items only (never blocking, no provisioning); omit if not cheaply available.
- [x] 3.5 `LaunchCampaign` command — re-resolve population, recompute readiness server-side, refuse on blocking conditions, freeze baseline, transition to `Launched`, write launch audit fact; `performance.cycle.publish`.
- [x] 3.6 Handler tests for population validation, approver override (incl. cross-tenant rejection), readiness classification, launch happy-path + fail-closed + permission/tenant denial.

## 4. API surface

- [x] 4.1 Reshape `PerformanceCyclesController` launch surface: `PUT /{id}/population`, `GET /{id}/population/preview`, `GET /{id}/readiness`, `PUT /{id}/participants/{employeeId}/approver`, `POST /{id}/launch` — each with deny-by-default authorization and tenant scoping.
- [x] 4.2 Define request/response DTOs in product-neutral shapes (population scope, readiness, participant + approver, launch result with frozen participant count).
- [x] 4.3 Controller/contract tests: authorization matrix (view/manage/publish), tenant isolation (cross-tenant → not found), validation and conflict responses distinct from success.

## 5. Migration

- [x] 5.1 Add EF migration: `Launched` status handling, `LaunchedAt`, exclusion `Reason`, participant approver columns.
- [x] 5.2 Same migration drops dead Packet-A-launch tables/columns (responsibilities, exception owners, duplicate launch snapshot, governance/feedback/frozen/preparation columns on the cycle).
- [x] 5.3 Verify `dotnet ef` builds the migration and the CI gate passes (build → migrate → has-pending-model-changes = none → migrate 0).

## 6. Frontend: API client & hooks

- [x] 6.1 Add `@repo/api` client methods for population set/preview, readiness, approver override, and launch, typed to the new DTOs.
- [x] 6.2 Add query/mutation hooks with optimistic reflection so applied changes appear immediately without a manual refresh; distinguish retryable errors from validation/conflict/permission.

## 7. Frontend: population → readiness → launch workspace

<!-- Design posture (standing, not a late pass): bold-and-characterful where it earns it, calm elsewhere; character expressed through @repo/ds + the single terminology voice; launch is the earned climax. See design.md decision 10. -->


- [x] 7.1 Add a Population scope surface in `campaigns/[slug]`: when no org-unit scope is selected, **explicitly show "All active employees"** (never an empty/unset state); org-unit scope picker with a descendants toggle; an exclusions list where each exclusion requires a reason — using `@repo/ds` controls (choices, not free-text for bounded values).
- [x] 7.2 Add a Readiness review surface: included participants with resolved approver, missing-approver and excluded groupings, and a per-participant approver override control (Core-employee picker + reason). Present readiness **optimistically** — a readiness-clear campaign reads as ready-to-launch, informational items (Core-context drift, best-effort approver access/account issues) are surfaced without foregrounding — never a blocker-management console. Render one truthful state (loading / resolved / recoverable error / permission-denied), never defaulted data as applied.
- [x] 7.3 Add the Launch action as the **earned climactic moment**: a confident, high-presence confirmation that **states the resolved participant count** and summarizes the participant + approver baseline to be frozen, making the irreversibility legible; block when readiness has blocking conditions; on success play a satisfying, legible Draft→Launched state change into the launched, read-only presentation of setup + baseline. Character via `@repo/ds` only — no decorative prose or one-off effects.
- [x] 7.4 Extend `campaign-terminology.ts` (single source) with population / readiness / approver / launch / launched labels and status→tone mappings in product language.
- [x] 7.5 Sidebar + breadcrumb: campaigns workspace shows Draft/Setup vs Launched state; breadcrumb stays anchored to the campaign; no route/enum labels leaked.
- [x] 7.6 Handle empty, permission-denied, and error states; verify responsive layout at mobile/tablet/desktop widths.
- [x] 7.7 Run an `impeccable` craft pass (constrained by Fusion repo rules) across the population → readiness → launch arc: give the pivotal moments (explicit all-active baseline, ready-to-launch state, the launch commit, the launched baseline) deliberate presence and hierarchy while keeping editing/scanning calm; confirm one system + one voice via `@repo/ds` and `campaign-terminology.ts`; strip any clutter, decorative text, or bold that doesn't earn its place. — Trimmed the launch dialog from four stacked messages to one description + two quiet footnotes (removed redundant count chip + bordered box), shortened the copy in `campaign-terminology.ts`.

## 8. Frontend tests

- [x] 8.1 Component tests: explicit all-active state when no scope set, population scoping (scope add, exclusion-requires-reason), optimistic readiness rendering + approver override, launch confirmation showing resolved participant count, launch flow (blocked vs enabled), and permission gating (view/manage/operate).

## 9. Verification (gates + rendered)

- [x] 9.1 Run `pnpm lint` and `pnpm type-check` (frontend) and `dotnet build` + `dotnet test` (Performance) — all green.
- [x] 9.2 Rendered browser walkthrough (Playwright): signed in as HR admin → opened a complete Draft campaign → set population (Software Engineering scope + Dana excluded with reason) → opened readiness → overrode Carol (missing-manager participant) approver to Dana → launched before the Jan 15 2027 opening date → confirmed the launched read-only baseline.
- [x] 9.3 Verify launch semantics in the rendered app: launch succeeds with a future opening date; the launch dialog states entry opens on the planning schedule (Sep 1 2026 / Jan 15 2027), not at launch; after launch all setup fields render disabled ("Read only") and Draft edits are no longer offered.
- [x] 9.4 Verify sidebar lifecycle state and campaign breadcrumb render correctly for Draft ("In setup") and Launched ("Launched" + "Read only") campaigns; breadcrumb stays anchored to the campaign in both states.
- [x] 9.5 Inspect the rendered UI for *felt* quality, not just correctness: the launch moment reads as decisive and the Draft→Launched change is satisfying and legible. Two felt-quality issues found and fixed during this pass — the over-verbose launch dialog (7.7) and an excluded-person label that leaked the raw employee id after a cycle refetch (fixed the enrichment effect's dependencies in `campaign-launch-sections.tsx`).
- [x] 9.6 Run `openspec verify --change performance-p1-2-objective-planning-population-launch` (or `/opsx:verify`) and reconcile any gaps before archiving.
