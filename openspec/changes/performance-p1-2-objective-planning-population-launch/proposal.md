## Why

P1.1 lets HR prepare a campaign Draft (identity, schedule, frozen planning-rules snapshot, strategic objectives) but the campaign cannot yet be populated or launched — it stops at "complete enough for later population." P1.2 closes that gap: HR selects who participates in objective planning, confirms every participant has a valid approver, and launches the campaign for planning orchestration, producing a **frozen participant baseline** and a **frozen default/overridden approver baseline** that the rest of P1 builds on.

A heavy, evaluation-oriented "Packet A" cycle lifecycle already exists in the backend (feedback-governance gating, responsibility curation, exception cases, workforce-delta acceptance, a `Draft → AssignmentPreparation → ReadyToLaunch → Active` flow) but was never surfaced to users, never spec-covered, and is now **dead code**. P1.2 does not build on it — it replaces the launch path with a lean model aligned to the P1 umbrella.

## What Changes

- Add an **objective-planning population scope** on a campaign Draft: an all-active baseline, org-unit scopes (with optional descendants), and manual **exclusions that require a reason**, resolved live against Core workforce truth (reads never write).
- Add a **launch readiness review** — a computed, live view (not a persisted state) of included participants, their resolved default approver, missing-approver cases, and excluded employees. It distinguishes blocking conditions (empty population, missing approver, no active strategic objective) from informational ones, and **fails closed**: launch is blocked while blocking conditions remain.
- Add an **approver baseline**: each participant's default approver is their Core primary manager; HR can **override** the approver per participant to another valid Core manager, with a reason. The resolved approver is frozen at launch.
- Add a single-step **launch** (`Draft → Launched`) that freezes an immutable participant + approver baseline (snapshotting Core identity/org/approver context) and marks the campaign **active for planning orchestration**. HR may launch **before** the planning opening date; employee objective entry stays gated by the planning schedule and is **not** opened by launch.
- After launch, campaign setup (identity, schedule, rules snapshot, strategic objectives, population) becomes **read-only**.
- Surface all of the above in the campaign workspace with polished, responsive UI (population scoping, readiness review, approver override, launch, launched read-only baseline), product-language terminology, sidebar/breadcrumb lifecycle state, permission and empty/error states.
- **BREAKING (internal, un-shipped): remove the dead Packet A cycle launch path** — governance gating, responsibility curation, `AssignmentPreparation`/`ReadyToLaunch` states, workforce-delta acceptance, and the duplicate launch-snapshot entity — from the campaign launch surface (endpoints, commands, tables). Scoped to the cycle launch path only; the separately dead evaluation modules (feedback, formal review, standalone exception-case workflow, campaign work items) are out of scope for this change.

## Capabilities

### New Capabilities
- `performance-campaign-population-launch`: HR defines the objective-planning population scope, reviews live launch readiness, sets a default/overridden approver baseline, and launches the campaign — freezing an immutable participant + approver baseline while keeping employee objective entry schedule-gated; tenant-isolated, deny-by-default, audited.

### Modified Capabilities
- `performance-navigation`: the campaigns workspace and campaign detail reflect campaign lifecycle state (Draft/Setup vs Launched) and present population, readiness, and launch inside the campaign workspace in product language, with the breadcrumb anchored to the campaign.

## Impact

- **Backend (`EY.HRPlatform.Performance`)**: `PerformanceCycle` aggregate (lean `Launched` state + `Launch` transition + frozen baseline), `Features/Cycles` commands/queries (population, readiness, approver override, launch), `PerformanceCyclesController` launch surface, `PerformanceDbContext` + a new migration (add launch/approver/exclusion-reason columns; drop dead launch-path tables/columns). Reuses `ICoreWorkforceClient` / `PerformancePopulationResolver` and the existing `performance.cycle.view/manage/publish` permissions.
- **Frontend (`apps/performance`)**: campaign detail workspace gains population, readiness, approver-override, and launch surfaces; `@repo/api` client + hooks; `campaign-terminology.ts` as the single label source; sidebar/breadcrumb lifecycle state. Aligns to `@repo/ds`.
- **Removed dead code**: Packet A cycle launch path (endpoints, commands, entities, tables) that P1.2 supersedes.
- **Downstream**: produces the launchable participant + approver baseline consumed by P1.3 (team objectives) and P1.4 (employee objective plans). No cross-tenant or Core-ownership changes — Performance continues to reference Core people via snapshots, never owning them.
