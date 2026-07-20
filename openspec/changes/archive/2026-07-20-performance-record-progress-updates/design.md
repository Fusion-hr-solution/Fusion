# Design: performance-record-progress-updates

## Context

P1 produced an immutable planning baseline: `EmployeeObjectivePlan` (Draft → Submitted → Changes requested → Approved) with a frozen approver, P1.6 reviewer reassignment (`PerformanceCycleApproverReassignment`), participant exclusion, and campaign-level planning lock (`PerformanceCycle.IsPlanningLocked`). `EmployeeObjective` carries locked title, alignment, weight, deadline, and method-structured measurement (quantitative indicator/target/unit as free text; qualitative success criteria). Nothing in the system records what happens after lock.

The operations spine is live and must be consumed, not re-invented: append-only `ActivityLogEntry` + `ActivityLogWriter`, post-commit domain-event dispatch, `PerformanceNotification` + `PerformanceNotifier` + shell bell, `IScheduledJob` runner with run ledger, and `AttachmentService` + `AttachmentOwnerAuthorization` (which today authorizes only the `PerformanceCycle` owner type and has no product UI consumer).

User-locked product decisions (2026-07-19):
1. Progress percent (0–100) is the canonical value for every objective; quantitative objectives may optionally capture an "actual result so far" as context — never auto-derived.
2. Completion is derived from the latest value: latest = 100% ⇒ Completed; a later lower update reopens the objective and requires explicit confirmation plus a short reason; everything append-only.
3. Detailed visibility: owning employee + participant's effective reviewer only. HR/Direction wait for later operational-insight work; this slice shapes read models and events they can later consume.
4. Post-lock, `My objectives` evolves into the living progress workspace; managers get a separate `Team progress` door (approval ≠ follow-up).

## Goals / Non-Goals

**Goals:**
- Append-only, trustworthy per-objective progress history with evidence, on top of the locked baseline — the baseline itself is never mutated.
- Derived truth: objective state (Not started / In progress / Completed, + stale signal) and weighted plan progress computed from history + locked weights, never stored as editable fields.
- A characterful employee progress workspace and a manager attention-first Team progress workspace, both state-complete (loading, empty, denied, not-locked-yet, error, mobile, dark).
- Full spine reuse: domain events → activity log + notifications; scheduled stale-reminder job; attachments as evidence with real UI.

**Non-Goals:**
- Check-ins, follow-up actions, manager comments on updates (next partition).
- HR/Direction aggregate views; progress analytics pages.
- Expected-progress forecasting, risk formulas, "Behind schedule" computation (needs an expected-progress model the umbrella defers).
- HR/manager correction of employee progress (`performance.objective.progress.correct` remains dormant).
- Configurable thresholds UI (stale threshold ships as a server-side constant).
- Cycle/campaign closure of progress recording (arrives with cycle closure, umbrella change 8).

## Decisions

### D1 — One append-only entity: `ObjectiveProgressUpdate`

A single new aggregate-adjacent entity (child of the plan aggregate boundary, persisted append-only like `ActivityLogEntry`):

- Identity + scope: `Id`, `TenantId`, `CycleId`, `PlanId`, `ObjectiveId`, `EmployeeId`.
- Value: `ProgressPercent` (int 0–100, required), `PreviousPercent` (int?, snapshot of the previous latest at write time — makes each row self-describing for history rendering and audit), `ActualValue` (string ≤120, optional, quantitative context), `Comment` (string ≤500, optional).
- Regression trace: `IsRegression` (derived at write: `ProgressPercent < PreviousPercent`), `RegressionReason` (string ≤300, required iff regression — server-enforced, not client-trusted).
- Actor + time: `ActorUserId`, `ActorName`, `CreatedAt` (UTC). No `UpdatedAt` — rows never change.
- Ordering: `(ObjectiveId, CreatedAt, Id)` index; "latest" = max by `CreatedAt` then `Id`.

**Why not** a mutable `CurrentProgress` column on `EmployeeObjective` plus a history table: two sources of truth that can diverge; the umbrella's boundary is explicit — current state must be *derived* from history. **Why not** reuse the activity log as the store: the activity log is an operational journal, not a queryable domain series; progress needs typed values, per-objective latest queries, and evidence linkage.

EF configuration mirrors the activity-log append-only enforcement (reject modifications/deletions at the persistence layer). One EF migration in the `performance` schema.

### D2 — Write rules: post-lock, owner-only, strict server validation

A progress update is accepted only when **all** hold: acting user is the employee-linked owner of the plan (`performance.objective.self.manage`, Self scope); the campaign is `IsPlanningLocked`; the plan is `Approved`; the participant is not excluded; the target objective belongs to that plan. Percent outside 0–100, regression without reason, or reason/comment/actual over length ⇒ rejected with field-level errors, entered values preserved client-side. Cross-tenant ⇒ not found. There is no update or delete endpoint for progress rows — corrections are new traced updates.

Deadlines do not block recording (consistent with P1's "deadline is context, not a gate"); the objective's locked deadline is shown as context.

### D3 — Derived state, computed in queries (no stored status)

- **Objective**: `currentPercent` (latest update or 0), `state`: Not started (no updates) / In progress / Completed (latest = 100). `stale` = not Completed AND newest update (or planning-lock time when none) older than `StaleAfterDays` (server constant, default 30 — V0's default cadence; configuration UI deferred).
- **Plan**: weighted progress = Σ(latestPercent_i × lockedWeight_i) / 100. Approved plans total exactly 100 by P1 construction, so the result is an exact 0–100.
- Reopening is not a distinct state: a confirmed lower update simply returns the objective to In progress; the history row carries the regression trace.
- Computed with grouped SQL (latest-per-objective) in query handlers, following the exact-SQL-counts precedent from cascade coverage. Read models (DTOs) expose these derived values to both the employee workspace and the manager view so later HR/Direction work can reuse the same query layer.

**Why not** "Behind/At-risk" states: they require an expected-progress-by-date model the umbrella explicitly defers; inventing a pro-rata formula now would fake precision.

### D4 — Evidence via the attachment spine, new owner type

Evidence files attach to a specific progress update: owner type `ObjectiveProgressUpdate`, owner id = update id. Flow: client uploads (pending) → submits the progress update with attachment ids → server commits attachments atomically with the update (abandoned pendings are already swept by `AttachmentCleanupJob`). `AttachmentOwnerAuthorization` gains a resolver for the new owner type: download allowed to the owning employee and the participant's current effective reviewer; everyone else denied. Upload limits/types stay as configured in the spine.

### D5 — Domain events → activity + notifications; one new job

New domain events raised by the write path and dispatched post-commit: progress recorded, objective completed (crossed to 100), objective reopened (confirmed regression from 100). Handlers (duplicate-safe, per spine contract):
- Activity log: every recorded update writes an activity entry (subject = plan/objective) — this is the auditable trail scenario.
- Notifications (to the participant's **effective reviewer**, dedup-keyed): objective completed; objective reopened/regressed. Routine updates do not notify — the Team progress workspace is the pull surface; noise kills the bell.
- New `PerformanceNotificationType` members: `ObjectiveCompleted`, `ObjectiveReopened`, `ObjectiveProgressStale`.

New `StaleProgressReminderJob` (`IScheduledJob`, registered like `DeadlineReminderJob`): for locked campaigns, notifies the owning employee for objectives stale per D3, dedup-keyed per objective + staleness window so repeated runs don't spam.

### D6 — Permissions: reuse Self for writes; new view permission for the manager door

- Writes + own reads: `performance.objective.self.manage` (Self) — recording progress on your own approved plan is the same self-management job P1.4 established; no new write permission.
- Manager door: new `PerformancePermissions.ObjectiveProgressTeamView = "performance.objective.progress.team.view"`, seeded into the Manager access profile. **Why not** reuse `performance.objective.team.approve`: approval and follow-up are distinct managerial jobs (user-locked); a tenant must be able to grant follow-up visibility without plan-approval power. Operational gate on top of the permission: the door and data appear only for users who are the effective reviewer of ≥1 participant in a locked launched campaign (hide-don't-deny; same `employeeId`-linked gating pattern as Team objectives). Effective reviewer resolution reuses the `GetPlanApprovalWorkspace` pattern (frozen approver overridden by latest `PerformanceCycleApproverReassignment`).
- Deny by default everywhere; cross-tenant answers not found.

### D7 — Frontend: evolve My objectives; new Team progress workspace; signature visuals

- **Employee** (`/performance/my-objectives/{slug}`): when the campaign is planning-locked and the plan Approved, the workspace renders the progress surface: a plan-level weighted progress hero (display-weight numeral + weighted meter built from the locked weights), and per-objective cards showing locked baseline context (weight, deadline, measurement, alignment), current percent, state, staleness, and a record-progress action. Recording opens a focused dialog: previous value visible, percent control (slider + numeric), comment, actual-result (quantitative only), evidence upload; entering a value below the previous one reveals the regression confirmation + reason inline (fail closed and quietly). Per-objective history renders as an append-only timeline (value transition, delta, comment, evidence, actor, time). Pre-lock states keep today's P1 behavior untouched.
- **Manager** (`/performance/team-progress`, `/performance/team-progress/{slug}`): campaign list door → team workspace ordered attention-first (needs-attention signals: stale, recent regression, not started; then in progress; completed last), each participant showing weighted plan progress and per-objective drill-in with the same history timeline, read-only. Empty/denied/not-locked states are truthful and action-inviting per the design standard.
- Terminology lives in the app's existing single-terminology-source pattern (`my-objectives-terms.ts` style); no backend enum names in UI. Shared visuals (progress meter, history timeline, evidence list) start app-local; promote to `@repo/ds` only if Core needs them — do not pre-abstract.
- Follow the loading-architecture memory: frame renders unconditionally, PageSkeleton in content area, fail-closed pending nav.

### D8 — API surface

New gateway-routed Performance endpoints (naming per existing feature routes): employee — get my progress workspace for a campaign (locked-plan + objectives + derived state + history), record a progress update (with attachment ids); manager — list my team-progress campaigns, get team progress workspace, get participant objective history. `@repo/api` performance client gains matching typed functions. Reads never write (the workspace GET does not create anything — unlike the P1.4 plan-on-first-open behavior, no auto-create exists here).

## Risks / Trade-offs

- [Latest-per-objective queries over a growing append-only table] → indexed `(ObjectiveId, CreatedAt, Id)`, grouped-latest SQL, and workspace queries bounded per plan/campaign; no unbounded cross-campaign scans.
- [Two updates racing on one objective could snapshot the same `PreviousPercent`] → writes serialize per plan via the plan's existing optimistic-concurrency `Version` bump; conflict returns a retryable validation error.
- [Notification noise for managers with large teams] → notify only completion/reopening, dedup keys, and the pull-first Team progress workspace as the primary surface.
- [Stale threshold as a constant may not fit every tenant] → accepted for this slice; the constant lives in one server-side options class so later configuration slots in without semantics changes.
- [First attachment UI consumer may surface spine gaps (progress dialogs, mobile)] → build the evidence UI against the real upload/commit flow early in implementation, not last; Playwright journey covers upload-with-update.
- [My objectives page file is already 1185 lines] → the progress surface lands as new components in `components/my-objectives/` (and a `progress/` subfolder), not appended to the existing page monolith.

## Migration Plan

Single additive EF migration (new table + indexes; new notification enum values are string-stored per existing converter conventions — verify storage mode during implementation). No changes to existing P1 tables. Rollback = revert migration; no data backfill needed. Seed: extend the Atlas demo tenant seed with realistic progress histories (mixed states: fresh, stale, regressed, completed) so the demo shows the narrative, not empty surfaces.

## Open Questions

None blocking — all four product-shaping decisions were resolved with the user on 2026-07-19 (percent-canonical values, derived completion with confirmed reopening, employee + effective reviewer visibility only, My objectives evolution + separate Team progress door).
