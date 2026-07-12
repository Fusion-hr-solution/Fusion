## Why

The launched campaign now carries strategy (P1.1), a frozen participant + approver baseline (P1.2), and manager-owned team objectives (P1.3) — but included employees still have no way to author their own objectives. P1.4 delivers the employee-facing planning slice: each included participant builds and submits a valid, weighted, aligned objective plan, producing the submitted plan that managers will review in P1.5. Without it, the cascade stops at the team level and no employee baseline exists for P2 tracking.

## What Changes

- Introduce the **employee objective plan** as a new business object: one plan per included participant per launched campaign, with a lean `Draft → Submitted` lifecycle.
- Add **individual objectives** as children of the plan — title, description, alignment target, weight, deadline, measurement method, and structured measurement detail (Quantitative: indicator + target value + unit; Qualitative: success criteria).
- Give employees a **"My objectives"** workspace (new sidebar door + routes + breadcrumbs) to open their campaign plan, see campaign strategy and the team objectives they may align to, create/edit/delete objectives while Draft, track weight total and objective count, and submit.
- Enforce **alignment** to either a team objective authored by the participant's frozen approver, or directly to an active campaign strategic objective (fallback).
- Enforce **schedule-gated entry**: employee authoring opens on the campaign's planning opening date; launch alone does not open entry. The submission deadline is shown as context (soft), not a hard block.
- Enforce **strict submission validation** against the campaign's frozen planning-rules snapshot: total weight = 100%, all required objective fields present, objective count ≤ frozen maximum, weights from the frozen allowed menu, measurement method from the frozen enabled set.
- Make **submitted plans read-only** to the employee (no self-withdraw in this slice) and capture a submission handoff (status, timestamp, frozen approver reference) so P1.5 can list them for review.
- Add the employee **self-manage** authorization path (`performance.objective.self.manage`, `Self` scope — already in the catalog) and per-plan ownership enforcement; **audit** plan/objective create, update, delete, and submit; keep every operation tenant-scoped and deny-by-default.
- Restrict **team-objective deletion** in P1.3 when employee objectives already align to it (referential safety now that links exist).

Non-goals (explicitly deferred): manager approval / request-changes / resubmission (P1.5); HR monitoring, reminders, escalations, blocker handling, planning lock (P1.6); progress tracking, check-ins, evaluation, ratings, 360/peer/upward feedback (P2/P3); objective template library; attachments; HR force-validation; post-submission amendment; hard overdue blocking.

## Capabilities

### New Capabilities
- `performance-employee-objective-plan`: The employee objective plan and its individual objectives — one plan per included participant per launched campaign; `Draft → Submitted` lifecycle; draft authoring (create/edit/delete objectives, flexible incomplete save); alignment to the participant's approver's team objectives or directly to campaign strategy; structured per-method measurement detail; schedule-gated entry; strict submission validation against the frozen planning rules (100% weight, required fields, max count, allowed weights, enabled methods); submitted read-only handoff for P1.5; participant-baseline access, per-plan ownership, tenant isolation, and audit.

### Modified Capabilities
- `performance-navigation`: Add the employee "My objectives" door, its routes (`/my-objectives`, `/my-objectives/[slug]`), breadcrumb behavior, and visibility gate (employee-linked account holding `performance.objective.self.manage`), kept distinct from the manager "Team objectives" door.
- `performance-team-objectives`: Restrict deletion of a team objective once one or more employee objectives align to it (referential safety), replacing the P1.3 "delete stays simple" allowance.

## Impact

- **Backend (Performance, `:5401`, schema `performance`)**: new `EmployeeObjectivePlan` aggregate + `EmployeeObjective` child entity, EF configurations + migration; new query/command handlers (get workspace, save draft objective, delete objective, submit plan); new `IPerformanceAccessPolicyService.CanManageOwnObjectives`; new controller; audit events; a guarded team-objective delete path. Consumes existing `PerformanceCycle` (schedule + `PlanningRulesSnapshot`), `PerformanceCycleParticipant` (frozen baseline), `CampaignStrategicObjective`, and `CampaignTeamObjective` — no changes to Core; no duplication of Core people/org truth.
- **Frontend (`Frontend/apps/performance`, `:3004`)**: new `/my-objectives` landing + `[slug]` workspace, employee objective components, API client + query hooks in `@repo/api`/app data layer, sidebar door + breadcrumb wiring; reuse `@repo/ds` and existing campaign/objective visual language.
- **Auth (`@repo/auth`)**: add `objectiveSelfManage` to the performance permission map and a `canAccessMyObjectives(user)` helper (employee link + `Self`-scoped self-manage).
- **No breaking API changes**; additive only. Tenancy and deny-by-default preserved throughout.
