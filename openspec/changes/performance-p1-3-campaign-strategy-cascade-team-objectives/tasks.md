# Tasks: performance-p1-3-campaign-strategy-cascade-team-objectives

## 1. Packet A objective code removal (clears the conflicting model first)

- [x] 1.1 Remove `Features/CollectiveObjectives` + `CollectiveObjectivesController`, `Features/Objectives` + `PerformanceObjectivesController`, and `Features/Milestones` + `ObjectiveProgressController`, with their DTOs and tests; verify no frontend or cross-service consumer exists before deleting each surface
- [x] 1.2 Assess compile-safety of dropping `PerformanceObjective`, `PerformanceObjectiveMilestone`, and `ObjectiveProgressEntry` (known reference: `Features/Exceptions/Commands/ResolveExceptionCase.cs:120`); drop entities + tables via migration only if safe, otherwise leave entities dormant and record the deferred drop in design.md
- [x] 1.3 Build + full Performance test suite green after removal (`dotnet build`, `dotnet test` for the Performance service)

## 2. Backend domain and persistence

- [x] 2.1 Add `CampaignTeamObjective` aggregate (per design D1: required title ≤200, active same-campaign strategic-objective link, success criteria ≤500, measurement method validated against the frozen snapshot's enabled methods, optional description ≤2000, immutable owner, no status/weight fields) with domain guards (campaign must be Launched) and unit tests
- [x] 2.2 Add EF configuration (xmin `Version`, FKs to cycle and strategic objective, indexes on `(TenantId, CycleId)`, `(TenantId, CycleId, OwnerManagerEmployeeId)`, `(TenantId, StrategicObjectiveId)`) and the additive migration; run the CI migration gate locally (`dotnet ef migrations has-pending-model-changes` clean)
- [ ] 2.3 Add team-objective audit actions to the existing `PerformanceCycleAuditEvent` mechanism (created/updated/deleted with actor, tenant, campaign, objective, changed fields)

## 3. Backend authorization and application layer

- [ ] 3.1 Extend `IPerformanceAccessPolicyService` per design D3: `CanManageTeamObjectives` (permission `performance.objective.team.manage`, any catalog scope), `CanViewCascadeCoverage` (`performance.strategic.view` OR `performance.cycle.view/manage`); no PlatformAdmin authoring bypass; tests for deny-by-default
- [ ] 3.2 Implement manager-scope resolution from the frozen baseline (`employee_id` claim → participants where `ApproverEmployeeId` matches), used by every authoring check and manager read; no Core reporting-line queries
- [ ] 3.3 Implement manager queries: my team-objective campaigns (launched + frozen responsibility, with schedule context and own objective counts), campaign workspace read (read-only active strategy, frozen scope summary, own team objectives)
- [ ] 3.4 Implement authoring commands: create / update (If-Match ETag, stale-write conflict) / delete, with ownership enforcement, launched-campaign + active-link + snapshot-measurement validation, tenant scoping (cross-tenant → not found), and audit writes
- [ ] 3.5 Implement the cascade coverage query (design D4: strategic objectives ± coverage, distinct frozen approvers ± team objectives with counts and scope sizes; launched campaigns only; read never writes) and the HR read-all-team-objectives view
- [ ] 3.6 Expose controller endpoints for 3.3–3.5 following existing `PerformanceCyclesController` patterns; integration tests covering success, validation, authorization (permission-without-responsibility, HR read-only, Direction strategic-view-only), tenancy, and concurrency scenarios from the delta specs

## 4. Frontend — manager Team objectives workspace

- [ ] 4.1 Add `@repo/auth` permission helpers for team-objective management and strategic view; add `Team objectives` sidebar entry + `/performance/team-objectives` routes and breadcrumbs (list → `[slug]` workspace); truthful empty states (no permission → no entry; permission but no frozen responsibility → product-language explanation)
- [ ] 4.2 Add team-objective terminology to the single terminology source (workspace labels, creation flow, availability footnote wording — no lifecycle words) and API client + query hooks in the existing app pattern (content-area skeletons, reads never write, saved changes reflect without refresh)
- [ ] 4.3 Build the campaign team-objectives workspace: strategy-to-translate (read-only), frozen scope summary (count, preview, org units, schedule context), and the manager's team-objective list; design the elevated version of the moment first (impeccable pass) — this is the manager's cascade cockpit, not an admin table
- [ ] 4.4 Build the create/edit experience as one clear business action (choose strategic objective → describe → success criteria → measurement method as bounded choice from the frozen snapshot → save), plus delete with confirmation; validation preserves entered values; conflict and permission failures are distinct and recoverable; quiet schedule-gated availability note per spec

## 5. Frontend — cascade coverage for HR and Direction

- [ ] 5.1 Add the cascade coverage surface to the launched campaign detail (`/performance/campaigns/[slug]`): coverage indicators, strategic objectives with/without coverage, managers with/without team objectives, HR read-only view of all team objectives; informational tone, no blocker framing, Draft campaigns show no coverage surface
- [ ] 5.2 Add the `Strategy` sidebar entry gated by strategic view + `/performance/strategy` routes (launched campaign list → per-campaign strategy & coverage) reusing the same coverage surface component; breadcrumbs per spec; no admin affordances leak to Direction
- [ ] 5.3 Impeccable pass over both doors: one product voice with the campaign workspace, coverage moment has presence (this is Direction's first dedicated surface), bold-vs-plain judged explicitly and recorded

## 6. Verification and completion gate

- [ ] 6.1 Backend: `dotnet build` + full Performance test suite; frontend: `pnpm --filter performance test`, `pnpm lint`, `pnpm type-check` (from `Frontend/`)
- [ ] 6.2 Rendered UI verification against the launched flow: seed a launched campaign, verify manager door (scope, create/edit/delete, empty states), HR coverage in campaign detail, Direction door with strategic-view-only account, schedule-gated wording, and no lifecycle labels anywhere; verify sidebar gating for a user with none of the permissions
- [ ] 6.3 Verify every delta-spec scenario is covered by a test or the rendered-UI check; update `openspec` change status and prepare progressive commits per `.local-docs/git-conventions` (leave push/PR to the user)
