# Proposal: performance-p1-3-campaign-strategy-cascade-team-objectives

## Why

P1.2 left campaigns launched with a frozen participant/approver baseline and read-only campaign strategy, but nothing connects that strategy to the people who must execute it. P1.3 makes the cascade operational: managers translate campaign strategic objectives into saved team objectives for their frozen campaign scope, giving P1.4 employees a meaningful alignment layer, and giving HR and Direction visibility into whether the cascade exists.

Product authority: `.local-docs/Performance/P1/p1-umbrella-specification.md` and `.local-docs/Performance/P1/p1.3.md` (V0 §"Team Objectives Module" confirms the manager-owned breakdown).

## What Changes

- **Manager team-objectives workspace (new door, not Campaigns):** a new `Team objectives` sidebar workspace listing launched campaigns where the signed-in user is the frozen approver of at least one participant. Per campaign it shows the read-only campaign strategy, the manager's frozen scope summary, and their team objectives.
- **Team objective authoring:** managers create, edit, and delete their own team objectives inside a launched campaign. A team objective has title, linked active campaign strategic objective, success criteria/target, measurement method drawn from the campaign's frozen planning-rules snapshot, and optional description. **No draft/publish lifecycle, no approval workflow, no weight** — saved = part of the cascade; the campaign schedule (not P1.3) gates when employees can use them.
- **Cascade coverage visibility:** one shared, read-only cascade coverage surface per launched campaign (strategic objectives with/without team-objective coverage, managers with/without team objectives, counts). HR reaches it from the campaign workspace; Direction reaches it through a lightweight `Strategy` sidebar entry gated by `performance.strategic.view` — no HR campaign permissions required.
- **HR is visibility-only:** HR views all team objectives and coverage; no HR authoring, approval, or exceptional-correction flow in this slice.
- **Audit:** team-objective create/update/delete recorded via the existing Performance audit mechanism (actor, tenant, campaign, objective, changed facts).
- **BREAKING (internal, dead code): remove superseded Packet A objective code.** The dormant `CollectiveObjectives` feature (approval-routed team objectives), Packet A objective authoring/submission/progress endpoints, and their `PerformanceObjective`-based surfaces conflict with the P1 model and are confirmed superseded. They are removed so two contradictory team-objective models never coexist. No production frontend or other module consumes them.

## Capabilities

### New Capabilities

- `performance-team-objectives`: manager-owned team objectives inside a launched campaign — authoring rules, frozen-scope derivation from the P1.2 approver baseline, linkage to active campaign strategic objectives, measurement from the frozen planning-rules snapshot, simple saved availability model, tenancy/permission boundaries, audit.
- `performance-cascade-coverage`: read-only cascade coverage/readiness for a launched campaign — coverage indicators for HR (orchestration view) and Direction (strategy view) with permission-gated access that does not require HR admin permissions for Direction.

### Modified Capabilities

- `performance-navigation`: adds the manager `Team objectives` workspace (gated by team-objective authoring responsibility), the Direction `Strategy` entry (gated by `performance.strategic.view`), and the cascade coverage surface inside the HR campaign workspace; breadcrumbs for the new areas.

## Impact

- **Backend (`Backend/EY.HRPlatform.Performance`)**: new `CampaignTeamObjective` entity + EF configuration + migration; new feature slice (commands/queries/DTOs/controller) for team objectives and cascade coverage; access-policy additions using existing `performance.objective.team.manage` and `performance.strategic.view` permissions; manager identity resolved from the existing `employee_id` claim; audit events via `PerformanceCycleAuditEvent`. Removal of Packet A objective feature slices (`Features/Objectives`, `Features/CollectiveObjectives`, `Features/Milestones` progress paths, `PerformanceObjectivesController`) and their entities/tables where no live dependency remains.
- **Frontend (`Frontend/apps/performance`)**: new `Team objectives` and `Strategy` sidebar workspaces and routes; team-objective workspace UI; cascade coverage surface in the campaign detail; terminology extensions in the single campaign terminology module; permission helpers in `@repo/auth` for team-objective and strategic-view gating.
- **Permissions/tenancy**: no new permission keys; deny-by-default checks combine permission + frozen-baseline responsibility; all reads/writes tenant-scoped.
- **Not affected**: Core HR (no live re-resolution of reporting lines — scope comes from the frozen baseline), Identity contracts, other interns' modules.

## Non-goals

- Employee objective creation/submission/approval (P1.4/P1.5); team-objective approval or draft/publish lifecycle; team-objective weights; multi-level strategy hierarchy or enterprise strategy governance; objective template library; progress tracking; reminders/escalations; planning lock; cascade on/off configuration (cascade is enabled by design per P1.3 §6.5); per-employee or sub-team assignment of team objectives (scope-level only); reopening launched campaign strategy editing; a dedicated Direction workspace beyond the shared coverage surface.
