## Context

The full investigation lives in `.local-docs/Performance/performance-product-hardening-exploration.md`; this design condenses its decisions. The live Performance product (P1 spine + the `performance-record-progress-updates` slice) is sound, but it carries a large Packet-A remnant surface that survived the P1.3 cleanup, plus a few correctness/observability/UX gaps in the live surface. This change removes the dead surface and closes the gaps, landing in the same branch/PR as the progress slice.

Current state established by the exploration (all code-verified):
- Dead feature areas `Features/{Feedback,Reviews,Exceptions,WorkItems}` with live `[Authorize]` controllers (`/api/performance/{feedback,reviews,work-items}`), no frontend or `@repo/api` consumer, and cross-references only from their own EF configs/enums and the **unwired** `CloseCycle` command.
- 14 dead tables in the current model snapshot; `PerformanceCycleStatus` carries dead `Active`/`Closed` values (its own doc-comment says they are never reached by the launch path).
- 7 dead permissions in `CorePermissionCatalog` + `PerformancePermissions.All`, seeded into role templates in `AccessProfileTemplates`.
- `EmployeeObjectivePlan.Version` is a real `IsRowVersion()` token, and `RecordProgress` mutates the plan (`UpdatedAt`) — so concurrency is enforced, but `RecordObjectiveProgress` does **not** catch `DbUpdateConcurrencyException` (every other cycle command does), so a lost race is a 500.
- `RecordObjectiveProgress` falls back to `Guid.Empty` when `currentUser.UserId` is null, writing an unattributable immutable row.
- `PerformancePermissions.All` and `CorePermissionCatalog.Definitions` are two hand-maintained lists (the cause of the already-fixed `ObjectiveProgressTeamView` 500).
- `progress-terms.ts` carries explainer captions; `teamProgressTerms.readOnlyNote` forward-references unbuilt check-ins.
- The Atlas seed "repairs" orphaned `PerformanceCycleApproverReassignment` rows rather than constructing clean data.
- Performance mirrors Core's workforce contract locally (`CoreWorkforceModels.cs`) with no contract test against Core's `WorkforceController`.

## Goals / Non-Goals

**Goals:**
- Delete the dead Packet-A surface end to end: code, controllers, entities, EF configs, enums, tests, tables, and permissions — including the Identity/SharedKernel tail.
- Make the progress write path's failure behavior match its design contract (retryable conflict; fail-closed actor).
- Permanently prevent the permission-catalog inconsistency class via one invariant test.
- Bring the progress/team-progress copy in line with the documented no-explanatory-text standard, with no forward-references to unbuilt features.
- Make the demo seed declarative; add a lightweight Core-contract guard.
- Keep every gate green (build, tests, migration gate, lint, type-check, frontend build) and re-verify the rendered progress surfaces after the deletions.

**Non-Goals:**
- Migration baseline squash (AR-2) — orthogonal and risky to bundle; a separate follow-up.
- My-objectives page monolith split (UX-2).
- Any new evaluation / check-in / cycle-closure capability — those are later umbrella changes; this change only clears the ground.
- Reintroducing any removed Packet-A behavior in a different shape.
- Reworking the healthy Core seam beyond the additive contract-fixture test.

## Decisions

### D1 — Delete the dead surface rather than deprecate it
The four feature areas, their controllers, entities, EF configs, and enums are removed outright, `DbSet`s dropped, and a single additive EF migration drops the 14 tables; the model snapshot is regenerated and the migration gate must be clean. **Why not** leave the tables dormant: that leaves permanent model-snapshot drift (the CI `has-pending-model-changes` gate would flag it) and 14 orphan tables in every tenant forever. **Why safe:** the tables are provably empty in the live flow (no product writer), and the module is pre-production with disposable seeded tenants. `CloseCycle` and the `Active`/`Closed` states go with them; real closure is designed later. Remove Feedback/Exception references from `PerformanceCycleAuditAction` and `CycleNotificationFactory` as part of the sweep, and verify `InactivitySweepJob` — remove it too if it only swept Packet-A state.

### D2 — Permission removal spans SharedKernel + Identity, guarded by one invariant test
The 7 dead permissions are removed from `PerformancePermissions`, `PerformancePermissions.All`, and `CorePermissionCatalog.Definitions`, and unseeded from `AccessProfileTemplates`. A new test asserts bidirectional catalog completeness (every `*.All` key ⇄ exactly one definition). **Why a test, not a refactor into one list:** merging the two lists is a larger change with its own risk; a single invariant test closes the failure mode immediately and cheaply, and keeps the existing structure. `ObjectiveProgressCorrect` stays (dormant by design). Already-provisioned tenants keep inert grants (no endpoint serves them) — noted in provisioning; no data migration required.

### D3 — Progress conflict handling mirrors the established cycle-command pattern
Wrap the `SaveChangesAsync` in `RecordObjectiveProgress` in `try/catch (DbUpdateConcurrencyException)` and return a typed retryable conflict (`Result` failure with a conflict error carrying the refreshed `plan.Version`), exactly as `LaunchCampaign`, `LockPlanning`, `OverrideParticipantApprover`, etc. do. The employee dialog maps the conflict to an input-preserving retry (re-read workspace, re-enable submit). **Why not** a broader locking scheme: the rowversion token already serializes correctly; only the error translation was missing.

### D4 — Fail closed on unknown actor
Replace the `currentUser.UserId ?? Guid.Empty` fallback with an explicit guard: a null user id returns an authorization failure and writes nothing. Recording is `performance.objective.self.manage` (Self scope); a null user id there is an auth-invariant violation, not a normal state, and an immutable audit row must never carry a placeholder actor.

### D5 — Copy discipline via the single terminology source
All copy edits happen in `progress-terms.ts` (`progressTerms` + `teamProgressTerms`): remove `weightedNote`, `actualHint`, `evidenceHint`, `listDescription`; remove the check-ins clause from `readOnlyNote` (or drop it entirely, since read-only is legible from the absence of actions). Optionality that must remain (e.g. an optional field) is expressed as a compact field marker, not a sentence. Empty-state descriptions are retained — the umbrella and the product standard both want guiding empty states.

### D6 — Seed becomes declarative; add a Core-contract guard
Root-cause the orphaned `PerformanceCycleApproverReassignment` rows (investigate the P1.6 reassignment/exclusion path for an orphaning bug; fix or guard it). The seed then constructs a clean Atlas demo (locked cycle, approved plan owner, backdated mixed-state progress) without a repair step. Separately, add a serialization-fixture round-trip test that deserializes a representative Core `WorkforceController` employee/org-unit payload into Performance's `CoreWorkforceModels` mirror, and shape `FakeCoreWorkforceClient` from the same fixture, so a Core-side reshape fails CI instead of silently yielding nulls at runtime.

### D7 — Front door: fix the drift now, defer the operational home
The Performance overview hardcodes its own door list, which drifted from the sidebar/breadcrumb (omitted `Team progress`; label/order mismatch) and carries a decorative always-on amber emphasis on Plan approvals. Fix in this change: derive the overview doors from the same shared `sidebar-nav` door definitions the sidebar and breadcrumb already use (single source), and make any "attention" emphasis reflect real pending work (or drop it). **Deliberately deferred:** turning the overview into a full role-aware operational home (employee next action, manager attention queue, HR completion/blockers) is the umbrella's change #10 ("consolidated role-based operational views") and depends on read models several later changes produce; building it now would either be shallow (vanity counts) or pull that change forward. **Why not** rebuild the home here: the umbrella explicitly warns against front-loading operational views before their workflows exist. The lean fix removes the bug and the redundancy without faking an operational surface.

### D8 — Optional visual token alignment
Map the four progress-visual tones to DS status tokens where a clean equivalent exists, instead of raw `emerald-/amber-` Tailwind scales. Low priority; skip if it forces a worse result than the current app-local visuals (design memory permits app-local visuals; the point is only to avoid one-off colours drifting from the Core palette).

## Risks / Trade-offs

- [Deleting live HTTP routes could break an unknown consumer] → Verified no frontend, no `@repo/api`, and no other backend caller references the three route groups; confirm again by grep before deletion and by a gateway route check after.
- [Drop migration is destructive] → Tables are empty in the live flow and tenants are disposable/pre-prod; migration is additive-only against live tables (drops dead ones), reversible by revert, no backfill.
- [Removing enum members (`Active`/`Closed`) could break persistence or tests] → Confirm no seed/test/persisted row uses them before removal; module is pre-prod so no value re-map is needed.
- [Backend test count drops as dead tests are removed] → Expected and correct; update any hard-coded "N tests pass" notes in docs/memory afterward.
- [Permission removal leaves inert grants on existing tenants] → No endpoint serves them; note in provisioning, optionally reseed templates.
- [Seed root-cause may surface a real P1.6 defect] → If so, fix it here (it is a data-integrity issue worth fixing); if the orphaning was manual tinkering, document and remove only the repair step.
- [Core-contract fixture can itself drift from real Core] → Keep the fixture representative and co-locate it; it is a guard against silent drift, not a full contract-management system.

## Migration Plan

1. Delete code (feature areas, controllers, entities, configs, enums, `CloseCycle`, dead permissions, dead tests) and remove `DbSet`s.
2. Generate one additive EF migration dropping the 14 tables; regenerate the model snapshot; `dotnet ef migrations has-pending-model-changes` must be clean.
3. Apply the live-surface fixes (D3–D6) and the invariant + contract tests.
4. Run full gates + a rendered smoke of both progress workspaces (light/dark/mobile) and a gateway route check confirming the three dead route groups return 404.
5. Rollback = revert the migration and the commits; no data backfill. Provisioning note: existing tenants retain inert removed-permission grants.

## Open Questions

- Does the P1.6 reassignment/exclusion path have a genuine orphaning bug (D6), or were the orphaned rows purely manual test residue? Resolved during implementation by tracing the reassignment writes; the fix vs. document decision follows from what the trace shows.
- Include the Core-contract fixture test (D6) in this PR or defer? Recommended in-scope as the lightest viable form; drop to a follow-up only if it balloons beyond a fixture round-trip.
- **Overview operational home (D7): DECIDED (2026-07-20)** — lean fix only this pass (fix drift + state-aware emphasis). The role-aware operational home is planned for a later pass, not this one. No next-action band is pulled forward here.
- **Page monoliths:** `campaigns-page.tsx` (~2,160 lines) and `my-objectives-pages.tsx` (~1,174) are maintainability risks but not demo blockers. Recommended Non-Goal here (extract in a dedicated refactor), noted so it is a deliberate deferral, not an oversight.
