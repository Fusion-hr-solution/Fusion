## 1. Domain model — plan aggregate & objectives

- [x] 1.1 Add `PlanStatus` enum (`Draft`, `Submitted`; reserve headroom, no other reachable states) and an `ObjectiveAlignmentType` enum (`TeamObjective`, `StrategicObjective`) under `Domain/Enums`.
- [x] 1.2 Add `EmployeeObjective` entity (child): title, description, alignment type + target id + denormalized alignment title, weight, deadline, measurement method, and structured measurement detail (`MeasurementIndicator`, `TargetValue`, `TargetUnit`, `SuccessCriteria`); normalization + length rules mirroring `CampaignTeamObjective`.
- [x] 1.3 Add `EmployeeObjectivePlan` aggregate root (`AggregateRoot, ITenantEntity`) owning a private `EmployeeObjective` list, `TenantId`/`CycleId`/`EmployeeId`, `Status`, `SubmittedAt`, frozen `ApproverEmployeeId`/`ApproverName`, and `uint Version`; expose `AddObjective`/`UpdateObjective`/`RemoveObjective` (Draft-only) and `Submit`.
- [x] 1.4 Implement aggregate invariants: Draft-only mutation, objective count ≤ frozen `MaxObjectiveCount`, weight ∈ frozen `AllowedWeightMenu`, measurement method ∈ frozen `EnabledMeasurementMethods` (canonical resolution like P1.3), and schedule-open enforcement passed in from the cycle.
- [x] 1.5 Implement `Submit(cycle, participant, now)`: re-validate all blocking rules against the frozen snapshot (total == 100, required per-method fields, count, weights, methods, every objective aligned), return a structured blocking-reasons result on failure (stay Draft), else stamp `Submitted`, `SubmittedAt`, and the frozen approver handoff.
- [x] 1.6 Unit-test the aggregate: draft flexibility, each blocking rule, count/weight/method rejection, alignment validation, submit success + handoff, and read-only-after-submit.

## 2. Persistence & migration

- [x] 2.1 Add `EmployeeObjectivePlanConfiguration` and `EmployeeObjectiveConfiguration` (owned collection, `xmin`→`Version`, string lengths, enum-to-string) and register via `ApplyConfigurationsFromAssembly`.
- [x] 2.2 Add unique index `(TenantId, CycleId, EmployeeId)` and FKs/indexes to cycle and participant; add `DbSet`s to `PerformanceDbContext`.
- [x] 2.3 Create migration `P14EmployeeObjectivePlans` (additive only); verify `has-pending-model-changes` is clean and the migration applies.

## 3. Authorization

- [x] 3.1 Add `CanManageOwnObjectives(ClaimsPrincipal)` to `IPerformanceAccessPolicyService` (default false) and implement it against `ObjectiveSelfManage` (`Self` scope); no Tenant/PlatformAdmin bypass.
- [x] 3.2 Add a resource-ownership guard used by every command/query: acting `EmployeeId` must equal the plan's `EmployeeId` and a `PerformanceCycleParticipant` must exist for `(CycleId, EmployeeId)`; fail closed for accounts without an employee link.

## 4. Backend feature slice (queries, commands, controller)

- [x] 4.1 `GetMyObjectivePlanCampaigns` query: list launched campaigns where the signed-in user is an included frozen participant (mirror `GetMyTeamObjectiveCampaigns`).
- [x] 4.2 `GetMyObjectivePlanWorkspace` query: get-or-create the Draft plan for an included participant with entry open (idempotent under the unique index); return plan + objectives, campaign/schedule context, live total weight & count, the approver's team objectives + active strategy as alignment options, and the resolved state (entry-not-open / draft / submitted / empty).
- [x] 4.3 `SaveObjective` command (create + update): Draft-only, schedule-gated, ownership-checked, validates weight/method/alignment/lengths; `If-Match` optimistic concurrency; writes audit.
- [x] 4.4 `DeleteObjective` command: Draft-only, ownership-checked, concurrency + audit.
- [x] 4.5 `SubmitObjectivePlan` command: server-side re-validation via the aggregate; returns structured blocking reasons on failure (preserving values), transitions + writes audit on success.
- [x] 4.6 `EmployeeObjectivesController` (`[Authorize]`): per-action `CanManageOwnObjectives` + ownership; tenant-scoped; cross-tenant answers not found; DTOs in `Features/EmployeeObjectives/Dtos`.
- [x] 4.7 Add the team-objective delete guard: block `DeleteTeamObjective` when any `EmployeeObjective` aligns to it (truthful reason); editing stays allowed; cover with a test.
- [x] 4.8 Handler tests: authorization (self permission required, non-owner denied, approver-cannot-author), tenant isolation (cross-tenant not found), schedule gating, get-or-create idempotency, submission validation, and the delete guard.

## 5. Frontend — auth, navigation, routes

- [x] 5.1 Add `objectiveSelfManage` to the `@repo/auth` performance permission map and a `canAccessMyObjectives(user)` helper (employee link + `Self`-scoped self-manage); unit-test the helper.
- [x] 5.2 Add the `My objectives` sidebar door to `sidebar-nav.ts` and gate it in `PerformanceSidebar`, distinct from `Team objectives`; update sidebar tests.
- [x] 5.3 Add routes `/my-objectives` (landing) and `/my-objectives/[slug]` (workspace); wire `performance-app-breadcrumb` to show `My objectives` → campaign name; update breadcrumb tests.
- [x] 5.4 Add API client + query/mutation hooks (workspace, save, delete, submit) in the app data layer / `@repo/api`, with `staleTime` per the loading-architecture convention and cache updates so edits reflect without manual refresh.

## 6. Frontend — employee workspace UX (impeccable)

- [x] 6.1 Landing: list the participant's launched campaigns with a truthful empty state (no campaign plan to work on); no error/blank surface.
- [x] 6.2 Design the workspace lead: a segmented weight meter toward 100% with display-weight numerals and `n of max` count as the signature element (reuse campaign/cascade visual language + `@repo/ds`), not a plain form — run the mandatory bold-version pass and record the judgement.
- [x] 6.3 Objective create/edit surface: bounded weight menu, alignment picker (approver's team objectives grouped, direct-strategy fallback), method-driven measurement fields (Quantitative: indicator/target/unit; Qualitative: success criteria), deadline; preserve entered values on validation failure.
- [x] 6.4 Draft guidance + submit: per-objective completeness, live remaining-to-100, decisive submit gated on validity with a confirmation; surface server blocking reasons truthfully.
- [x] 6.5 State surfaces: entry-not-open notice (schedule context, no authoring), read-only Submitted plan (awaiting manager review, no withdraw), recoverable error, permission-denied — each a first-class truthful state using the single terminology source.
- [x] 6.6 Content-area loading skeleton (frame renders unconditionally); reads never mutate; product language only (no enum/lifecycle codes).

## 7. Verification & completion gate

- [x] 7.1 Backend: `dotnet build` + `dotnet test` for Performance green; migration verified.
- [x] 7.2 Frontend: `pnpm --filter performance test`, `pnpm --filter @repo/auth test`, `pnpm lint`, `pnpm type-check` green.
- [x] 7.3 Render-verify each workspace state (entry-not-open, draft authoring, invalid submit blocked, valid submit → read-only, empty) in the running app; confirm `My objectives` and `Team objectives` stay distinct.
- [x] 7.4 Run the `impeccable` pass on the workspace (elevation + character, not only correctness); correct weak controls/duplicated flows/unfinished states before marking done.
- [x] 7.5 Confirm the frontend quality matches backend completeness for the capability; update `openspec` status and prepare for `/opsx:verify`.
