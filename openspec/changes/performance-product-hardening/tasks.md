## 1. Remove the dead Packet-A backend surface

- [x] 1.1 Delete feature areas `Features/Feedback`, `Features/Reviews`, `Features/Exceptions`, `Features/WorkItems`, and `Features/Cycles/Commands/CloseCycle.cs`
- [x] 1.2 Delete controllers `FeedbackController`, `FormalReviewsController`, `CampaignWorkItemsController`
- [x] 1.3 Delete the entities + EF configurations: Feedback×6 (`FeedbackTemplateSnapshot`, `FeedbackPromptSnapshot`, `FeedbackPromptAnswer`, `FeedbackResponseContent`, `FeedbackResponseVersion`, `FeedbackIdentityMapping`), FormalReview/PerformanceReview×5 (`PerformanceReview`, `PerformanceReviewCriterionResponse`, `FormalReviewDefinitionSnapshot`, `FormalReviewCriterionSnapshot`, `FormalRatingScaleLevelSnapshot`), Exception×2 (`ExceptionCase`, `ExceptionCaseHistoryEntry`), `CampaignWorkItem`; remove their `DbSet` declarations from `PerformanceDbContext`
- [x] 1.4 Delete the dead enums (`FeedbackResponseStatus`, `FeedbackResponseType`, `ExceptionCaseStatus`, `CampaignWorkItemStatus`, `CampaignWorkItemType`) and prune Feedback/Exception references from `PerformanceCycleAuditAction` and `CycleNotificationFactory`
- [x] 1.5 Remove `Active` and `Closed` from `PerformanceCycleStatus` after confirming no seed/test/persisted row uses them
- [x] 1.6 Verify `InactivitySweepJob` liveness; remove it (and its registration) if it only swept Packet-A state
- [x] 1.7 Delete the dead test files (`Features/Feedback/*`, `Features/Exceptions/*`, `Domain/PerformanceReviewTests.cs`, `Domain/CampaignWorkItemTests.cs`, and any Exception/Review/WorkItem/CloseCycle tests)
- [x] 1.8 Grep-verify zero residual references to the deleted types across the solution

## 2. Remove the dead permissions (SharedKernel + Identity)

- [x] 2.1 Remove `ReviewSelfManage`, `ReviewTeamManage`, `FeedbackSubmit`, `ExceptionManage`, `ExceptionAction`, `ExceptionOverride`, `ExceptionAuditView` from `PerformancePermissions`, `PerformancePermissions.All`, and `CorePermissionCatalog.Definitions` (keep `ObjectiveProgressCorrect`)
- [x] 2.2 Remove the corresponding seedings from `AccessProfileTemplates`
- [x] 2.3 Add the bidirectional catalog-completeness invariant test (every module `*.All` key ⇄ exactly one `CorePermissionCatalog` definition; fails naming the offending key)
- [x] 2.4 `dotnet build` + `dotnet test` green; add a provisioning note that existing tenants retain inert removed-permission grants

## 3. Drop the dead tables

- [x] 3.1 Generate one additive EF migration in the `performance` schema dropping the 14 dead tables; regenerate `PerformanceDbContextModelSnapshot`
- [x] 3.2 `dotnet ef migrations has-pending-model-changes` clean; migration applies and reverts cleanly

## 4. Harden the progress write path

- [x] 4.1 Wrap `SaveChangesAsync` in `RecordObjectiveProgressCommandHandler` in `try/catch (DbUpdateConcurrencyException)` and return a typed retryable conflict carrying the refreshed plan version (mirroring the cycle-command pattern)
- [x] 4.2 Replace the `currentUser.UserId ?? Guid.Empty` fallback with a fail-closed guard (null user id → authorization failure, no row written)
- [x] 4.3 Integration tests: two same-version concurrent writes → first succeeds, second returns the typed conflict (no 500); a null-user request writes no row; a recorded update attributes a non-empty actor
- [x] 4.4 Frontend: the record-progress dialog maps the conflict result to an input-preserving retry (re-read workspace, re-enable submit); component test for the conflict path

## 5. Copy discipline on the progress surfaces

- [x] 5.1 In `progress-terms.ts`, remove `weightedNote`, `actualHint`, `evidenceHint`, and `teamProgressTerms.listDescription`; express any remaining optionality as a compact field marker, not a sentence
- [x] 5.2 Remove the check-ins forward-reference from `teamProgressTerms.readOnlyNote` (drop the sentence; read-only is legible from the absence of actions)
- [x] 5.3 Keep the empty-state descriptions (`emptyListDescription`, `emptyScopeDescription`, `accessTitle`); component tests still assert the guiding empty states
- [x] 5.4 (Optional, UX-5) Map the four progress-visual tones to DS status tokens instead of raw Tailwind colour scales where a clean equivalent exists

## 5b. Overview / navigation consistency

- [x] 5b.1 Drive the Performance overview (landing) doors from the shared `sidebar-nav` door source used by the sidebar and breadcrumb, so the three cannot drift; this restores the missing `Team progress` door and aligns door labels + order
- [x] 5b.2 Make overview door emphasis reflect operational state (or remove the fixed decorative amber "warning" emphasis on Plan approvals so colour is not used decoratively)
- [x] 5b.3 Component test: for a role with Team progress, the overview and sidebar expose the identical door set (guards against future drift)

## 6. Seed and Core-contract guard

- [x] 6.1 Trace the P1.6 reassignment/exclusion path for an orphaning bug; fix or guard it if real, otherwise document that the orphaned rows were manual residue
- [x] 6.2 Make the Atlas demo seed declarative — construct the locked cycle, approved plan owner, and backdated mixed-state progress without a repair step
- [x] 6.3 Add a serialization-fixture round-trip test pinning `CoreWorkforceModels` to a representative Core `WorkforceController` employee/org-unit payload; shape `FakeCoreWorkforceClient` from the same fixture

## 7. Verification and finish

- [x] 7.1 Full gates: `dotnet build` + `dotnet test` (+ migration gate), `pnpm lint`, `pnpm type-check`, `pnpm --filter performance test`, frontend build
- [x] 7.2 Rendered smoke through the shell (`:3000`): employee progress workspace + manager team progress in light/dark/mobile; bell; confirm `/api/performance/{feedback,reviews,work-items}` return 404 at the gateway
- [x] 7.3 Update docs/memory notes that referenced the now-removed backend test count and the Packet-A surface
- [x] 7.4 `openspec validate performance-product-hardening --strict`; then `openspec status` review — STOP: no commit, push, or PR until the user gives the go-ahead
