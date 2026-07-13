Here is the consolidated umbrella we should use.

# Full Lean MVP P1 Umbrella — Performance Planning Campaign

```text
Strategy → Team objectives → Employee objectives → Approval → Lock
```

P1 outcome:

> One approved, auditable, locked objective baseline for every included employee, ready for P2 tracking.

P1 is a **campaign-based planning lifecycle**, not a single HR form and not just “Draft management.” V0 describes P1 as campaign setup, strategic framework, breakdown into team and individual objectives, and managerial validation.

---

# 1. Core product model

## Campaign

The campaign is the container for the P1 planning stage of a performance cycle.
It is not an evaluation or 360-feedback campaign.

Example:

```text
2026 Annual Performance Planning
```

It owns:

- campaign setup;
- planning schedule;
- planning rules snapshot;
- strategic objectives used for that campaign;
- selected population;
- team objectives;
- employee objective plans;
- approval state;
- planning lock.

The campaign is created by HR, but the work inside the campaign is distributed across roles.

---

# 2. Role-specific workspaces

## Platform Admin

Purpose:

> Manage platform-level system boundaries, not business campaign work.

Workspace:

```text
Platform administration
→ Performance configuration
```

Owns:

- platform hard limits;
- supported measurement methods;
- starting configuration for new tenants.

Does **not** manage campaign strategy, population, team objectives, or employee objectives.

Status:

```text
DONE
```

---

## Tenant Admin / HR Admin

Purpose:

> Configure tenant planning rules and orchestrate the campaign.

Workspaces:

```text
Configuration
→ Planning rules

Campaigns
→ Campaign setup
→ Population/readiness
→ Monitoring/lock
```

Owns:

- tenant planning configuration;
- campaign creation;
- planning schedule;
- population selection;
- launch readiness;
- monitoring;
- reminders;
- blocker resolution;
- planning lock.

HR can currently define campaign-scoped strategic objectives in P1.1, but long-term, strategic ownership should be separated for Direction.

---

## Direction / Top Management

Purpose:

> Own strategic direction and see strategic alignment.

Workspace:

```text
Strategic objectives
→ Campaign strategy
→ Alignment overview
```

Owns or co-owns:

- campaign strategic objectives;
- strategic alignment visibility;
- high-level coverage/progress toward strategy later.

Important:

```text
Direction is not a PlatformRole.
Direction is a tenant business role / access profile / permission scope.
```

Direction should not need HR admin campaign permissions to manage or view strategy.

---

## Manager

Purpose:

> Translate strategy into team objectives and approve employee objective plans.

Workspace:

```text
Team objectives
→ My team objectives
→ Employee plan approvals
```

Owns:

- team/department objectives for their scope;
- alignment of team objectives to campaign strategic objectives;
- review and approval of employee objective plans;
- request changes when employee plans need correction.

A manager may also be an employee in the same campaign, so they can have:

```text
Manager role work: team objectives + approvals
Employee role work: own individual objectives
```

---

## Employee / Collaborator

Purpose:

> Create their own individual objectives.

Workspace:

```text
My objectives
→ My campaign objective plan
```

Owns:

- individual objectives;
- weights;
- measurement details;
- alignment to team or strategic objectives;
- submission of their objective plan.

---

## System

Purpose:

> Enforce rules, notify, audit, and protect consistency.

Owns:

- weight validation;
- date/status rules;
- permission checks;
- tenant isolation;
- audit;
- reminders;
- overdue flags;
- lock validation.

---

# 3. Objective definitions

## Strategic Objective

Owned by:

```text
Direction / HR depending on maturity
```

Meaning:

> A company or campaign-level priority.

Example:

```text
Improve customer satisfaction
```

In lean MVP:

```text
Campaign-scoped strategic objectives
```

Future-compatible model:

```text
Direction-owned strategic objectives
→ selected/copied/snapshotted into a campaign
```

Current status:

```text
P1.1 campaign-scoped strategic objectives — DONE
Direction Strategy door (read-only strategy + cascade coverage) — DONE (P1.3)
Direction-owned strategy authoring — NOT STARTED
```

---

## Team Objective

Owned by:

```text
Manager
```

Meaning:

> A team or department-level translation of a strategic objective.

Example:

```text
Support team reduces average response time to 4 hours
```

Alignment:

```text
Team objective → linked to campaign strategic objective
```

Status:

```text
DONE (P1.3)
```

---

## Employee Objective

Owned by:

```text
Employee
```

Meaning:

> One individual goal inside the employee’s campaign plan.

Example:

```text
Handle 95% of assigned tickets within SLA
```

Alignment:

```text
Employee objective → linked to team objective
or directly to strategic objective
```

Status:

```text
DONE (P1.4)
```

---

## Employee Objective Plan

Meaning:

> The employee’s full set of objectives for the campaign.

Example:

```text
Employee objective plan
├── Objective 1 — 40%
├── Objective 2 — 30%
└── Objective 3 — 30%
Total = 100%
```

The manager approves the **objective plan**, not each objective one by one.

Status:

```text
DONE (P1.4)
```

---

# 4. Campaign lifecycle

This is the business lifecycle, not one giant wizard.

```text
1. HR creates campaign setup                          — DONE  (P1.1)
2. Direction/HR defines campaign strategy             — DONE  (P1.1, HR-defined; Direction workspace later)
3. HR selects population and checks readiness         — DONE  (P1.2)
4. HR launches campaign for planning orchestration    — DONE  (P1.2)
5. Managers create team objectives                    — DONE  (P1.3)
6. Employees create individual objective plans        — DONE  (P1.4)
7. Managers approve or request changes                — DONE  (P1.5)
8. HR monitors, resolves blockers, and locks planning — NEXT  (P1.6)
```

The V0 actor table supports this split: HR creates/activates the campaign, HR/Management enters strategic objectives, managers break them into team objectives, collaborators create individual goals, managers validate, and the system records/notifies/verifies rules.

---

# 5. P1 delivery slices

## P1.1 — Campaign Setup Foundation — DONE

Purpose:

> HR prepares the campaign container before population and launch.

Done:

- Platform Performance Configuration;
- Tenant Objective Planning Configuration;
- campaign setup creation;
- planning schedule;
- frozen tenant planning rules snapshot;
- campaign-scoped strategic objectives;
- setup readiness.

Current shipped outcome:

```text
HR can create and prepare a campaign setup with planning rules, schedule, and strategic objectives,
but cannot yet populate, launch, or run objective planning.
```

Important polish already aligned:

```text
Business-facing language = Campaign setup / Setup readiness
Backend status may still be Draft
Avoid making the product feel like a Draft editor
```

The current task scope confirms P1.1 is Draft-only and excludes population, activation, team objectives, employee objectives, approval, reminders, and lock.

Implementation notes (shipped):

```text
Delivered and OpenSpec-archived across several slices:
- Platform Performance Configuration (hard limits, measurement methods, tenant starting defaults)
- Tenant Objective Planning Configuration (unified apply contract, route /configuration/performance)
- Campaign draft foundation: single-workspace authoring, create dialog, discard
- Planning schedule (ordered milestones) + frozen planning-rules snapshot copied at draft time
- Campaign-scoped strategic objectives (add / edit / activate-deactivate)
- Setup readiness (name+year, schedule in order, objective rules captured, ≥1 active objective)
- Business-facing language: "Campaign setup" / "Setup readiness"; backend status stays Draft ("In setup")
Deferred out of P1.1: unified Performance+Core audit/history UI (internal audit still written).
```

---

## P1.2 — Objective Planning Population & Launch — DONE

Purpose:

> HR selects who participates in the objective-planning stage and launches objective planning for the campaign.

Clarification:

In P1.2, “population” means the employees included in the P1 objective-planning stage who must eventually have an approved objective plan.

It does **not** define evaluation subjects, 360 respondents, peer reviewers, upward-feedback relationships, anonymous feedback flows, or other future evaluation/feedback campaign rules. Those belong to later performance processes.

Business outcome:

```text
The campaign has a frozen objective-planning participant baseline and a manager/approver baseline.
Objective planning is launched for the campaign, while employee objective entry remains controlled by the planning schedule.
```

Implementation notes (shipped, OpenSpec-archived 2026-07-10):

```text
Lifecycle: lean single Draft → Launched transition. Launch freezes a per-participant baseline
(PerformanceCycleParticipant = employee + resolved approver snapshot) and stamps LaunchedAt.
The old "Packet A" launch path was removed as dead code. Active/Closed enum values are reserved
for later slices (P1.3–P1.6), not reachable in P1.2.

Population: an empty scope set is the implicit all-active baseline; org-unit scopes (with optional
include-descendants) and explicit include/exclude-employee rules refine it. Participants are derived
from Core workforce truth. Exclusions require a reason; conflicting include+exclude is rejected.

Approvers: default approver = employee's primary manager from Core. HR can override a single approver
per participant with a required reason. Overrides carry an "Overridden" marker into the frozen baseline.

Readiness: live, server-recomputed, fail-closed. Blocking conditions (no participants, a participant
with no approver, no active strategic objective) disable launch; informational conditions (e.g. an
inactive approver) are surfaced without blocking. Launch re-checks readiness server-side before freezing.

Launch ≠ open entry: launching activates the planning stage for orchestration but employee objective
entry stays gated by the scheduled opening date. The confirm dialog states this explicitly.

Concurrency & audit: optimistic concurrency via PostgreSQL xmin mapped to an If-Match ETag; child
inserts (rules / overrides / participants) are eagerly tracked so they order correctly against the
versioned parent update. Audit events written for population update, approver override, and launch.

Frontend: one campaign workspace — population editor → live readiness review → launch → launched
read-only baseline. Content-area loading skeleton; saved edits reflect without a manual refresh.
Launch confirmation trimmed to one decisive line + a quiet schedule footnote.
```

Current shipped outcome:

```text
HR can define and review the planning population and approver coverage, exclude people with a reason,
override individual approvers, and launch objective planning — freezing a participant + approver
baseline — while employee objective entry remains controlled by the planning schedule.
```

## P1.3 — Campaign Strategy Cascade & Team Objectives — DONE

Purpose:
Managers translate the campaign’s strategic objectives into team objectives for their campaign planning scope.

Business outcome:
The launched campaign now has manager-owned team objectives linked to campaign strategic objectives, giving employees a meaningful alignment layer for P1.4 objective planning.

Core flow:
HR launches objective planning in P1.2
→ managers open their campaign team-objectives workspace
→ managers see the campaign strategic objectives and their frozen campaign scope
→ managers create team objectives linked to campaign strategic objectives
→ saved team objectives become available for employee objective planning
→ HR and Direction see cascade coverage/readiness
→ P1.4 employees use the available team objectives as the main alignment layer for individual objectives

Implementation notes (shipped):

```text
Model: a new CampaignTeamObjective aggregate — manager-owned, linked to one active campaign
strategic objective — with NO draft/publish lifecycle (saved = part of the cascade). It reuses the
frozen planning-rules measurement methods and never mixes in employee-objective, progress, or
evaluation concerns. Team-objective weight is deliberately out of scope (P1.4 owns weighting).

Manager scope: derived from the frozen P1.2 approver baseline, not live Core reporting lines. A
manager is responsible for the participants for whom they are the frozen approver in the launched
campaign; the workspace surfaces that scope (count, org units, participant preview) read-only.

Surfaces (three doors, one visual language):
- Manager cockpit — the campaign cascade as collapsible per-strategic-objective lanes; gaps stay
  open and washed gold, covered lanes fold away. Create/edit/delete inline; saved objectives appear
  immediately (no publish, no approval, no lifecycle labels).
- HR — read-only cascade coverage inside the launched campaign workspace (informational, never a
  blocker).
- Direction — a dedicated Strategy door showing the same coverage truth without HR campaign
  permissions.
A shared cascade-visuals module (segmented coverage bar, objective lanes, avatar clusters, person
rows) keeps all three surfaces one product.

Access & tenancy: authoring is gated on canAccessTeamObjectives — the manage permission AND an
employee link, so HR/Org admins holding the permission at Tenant scope (never a frozen approver) see
the door hidden rather than dead-ending. Direction reads via tenant-scoped strategic-view permission.
All operations tenant-scoped and deny-by-default. Creation, update and deletion are audited.

Availability & editing: team objectives can be created once the campaign is launched; employee
consumption stays gated by the planning schedule (the workspace states when the team will see them).
Deletion stayed simple in P1.3, then P1.4 added the dependency guard: a team objective cannot be
deleted once an employee objective aligns to it.

Scalability: the cascade coverage response caps its team-objective list at 500 while counts are
grouped in SQL over the full set, so totals stay exact and clients detect truncation via the count.
Optimistic concurrency via If-Match on edit/delete.
```

Current shipped outcome:

```text
Managers translate launched campaign strategy into saved team objectives for their frozen campaign
scope, while HR and Direction see cascade coverage/readiness — the alignment layer employees will use
in P1.4 to build individual objective plans.
```

---

## P1.4 — Employee Objective Plan Creation & Submission — DONE

Purpose:

> Employees create, edit, and submit their campaign objective plan.

Business outcome:

```text
Each included employee has a submitted objective plan made of valid weighted objectives,
ready for manager review in P1.5.
```

Core flow:

```text
Employee objective planning opens according to the campaign schedule
→ employee opens My objectives for the launched campaign
→ employee sees campaign strategy and available team objectives
→ employee creates individual objectives
→ each objective is aligned to a team objective or directly to a campaign strategic objective
→ employee defines weight, deadline, measurement details, and success criteria
→ employee saves the plan as draft while working
→ employee submits when the plan is complete and total weight = 100%
→ submitted plan becomes ready for manager review in P1.5
```

Includes:

- employee objective plan;
- individual objectives;
- draft save;
- submit;
- alignment to team objective or directly to campaign strategic objective;
- objective title;
- description/context;
- weight;
- deadline;
- measurement method / KPI / success criteria;
- validation against the campaign’s frozen planning rules;
- block submission unless total weight = 100%;
- block submission if required objective fields are missing;
- employee access only to their own campaign objective plan;
- manager-as-employee support through the employee “My objectives” experience.

Important decisions:

```text
Employee objective plans have a small lifecycle:
Draft → Submitted
```

```text
P1.4 stops at Submitted.
Manager approval, request changes, and resubmission belong to P1.5.
```

```text
Draft saving can be flexible.
Submission must enforce the blocking business rules.
```

```text
Employee objective entry is controlled by the campaign planning schedule.
Launch alone does not open employee objective entry.
```

Outcome:

```text
Employees can submit valid weighted objective plans for the launched campaign.
Those submitted plans are ready for manager review.
```

Implementation notes (shipped, OpenSpec-archived 2026-07-12):

```text
Model: new EmployeeObjectivePlan aggregate with a small Draft → Submitted lifecycle and child
EmployeeObjective records. Plans are unique per tenant/campaign/employee, belong to the frozen P1.2
participant baseline, and capture the frozen approver handoff at submission. Draft mutation is allowed
only before submission; submitted plans are read-only until P1.5 review work exists.

Rules: draft save is intentionally flexible, but submit re-validates every blocking rule against the
campaign's frozen planning-rules snapshot: total weight must equal 100%, weights must come from the
allowed menu, objective count cannot exceed the frozen maximum, measurement method must be enabled,
method-specific fields must be complete, and every objective must align to either the approver's team
objective or an active campaign strategic objective. Employee objective entry remains schedule-gated;
launch alone does not open authoring.

Access: the new self-management permission is scoped to the employee's own plan and requires an
employee link. Non-participants, cross-tenant requests, approvers acting on someone else's plan, and
accounts without an employee identity fail closed. Manager-as-employee works through the same My
objectives door, separate from Team objectives.

Backend/API: employee objective commands and queries cover campaign listing, workspace get-or-create,
save objective, delete objective, and submit. Writes use optimistic concurrency, preserve entered
values on validation failure, and audit objective save/delete/submit events. Team-objective deletion is
now blocked when employee objectives align to that team objective.

Frontend: Performance now exposes My objectives with its own landing and campaign workspace. The
workspace uses a segmented weight meter and objective count as the lead planning shape, with bounded
weight choices, grouped alignment options, method-driven measurement fields, live remaining-to-100
guidance, server blocking reasons, content-area loading skeletons, entry-not-open, empty,
recoverable-error, permission-denied, draft, invalid-submit, and submitted read-only states.

Spec sync: OpenSpec created the main performance-employee-objective-plan spec, updated Performance
navigation for My objectives, and updated team objectives with the dependency-aware delete rule.
```

## P1.5 — Manager Review & Plan Approval — DONE

Purpose:

> Managers review submitted employee objective plans and either approve them or request changes.

Business outcome:

```text
Submitted employee objective plans become either approved planning baselines
or are returned to employees for correction and resubmission.
```

Core flow:

```text
Employee submits objective plan in P1.4
→ manager opens Employee plan approvals
→ manager sees submitted plans assigned to them through the frozen P1.2 approver baseline
→ manager reviews the full employee objective plan
→ manager either approves the plan
→ or requests changes with a required comment
→ if changes are requested, the employee can edit the plan again
→ employee resubmits the corrected plan
→ approved plans become ready for HR completion monitoring and planning lock in P1.6
```

Includes:

- manager approval queue;
- submitted plans assigned to the frozen approver;
- full employee objective plan review;
- plan-level approval;
- request changes with required comment;
- employee correction after change request;
- employee resubmission;
- approved plan read-only state;
- audit of approval, change request, and resubmission;
- manager-as-employee separation between reviewing others’ plans and managing their own plan.

Important decisions:

```text
Approval is plan-level, not objective-by-objective.
```

```text
Manager actions are:
Approve plan
or
Request changes
```

```text
Request changes reopens the plan for employee correction.
```

```text
Approved plans become read-only planning baseline candidates for P1.6.
```

```text
P1.5 does not lock the campaign.
HR monitoring, reminders, blocker resolution, and planning lock belong to P1.6.
```

Not included:

- HR monitoring dashboard;
- bulk reminders;
- escalation matrix;
- planning lock;
- progress tracking;
- evaluation scoring;
- ratings;
- 360 feedback;
- HR force validation;
- post-lock amendment workflow.

Outcome:

```text
Managers can validate submitted employee objective plans.
Employees can correct and resubmit plans when changes are requested.
Approved plans are ready for HR monitoring and final planning lock in P1.6.
```

Implementation notes (shipped, OpenSpec-archived 2026-07-13):

```text
Model: EmployeeObjectivePlan now extends the P1.4 lifecycle from Draft → Submitted into
ChangesRequested and Approved. Review events are append-only and record Submitted,
ChangesRequested, Resubmitted, and Approved actions, including the manager actor, comment when
required, timestamp, and optional objective references for change-request guidance. Approved is
terminal in this slice; there is no un-approve, reversal, reopen, or amendment flow.

Approval semantics: approval remains plan-level. Manager actions are only Approve plan and Request
changes. Request changes requires a comment, returns the full plan to the employee, and can reference
specific objectives without creating objective-by-objective approval. Employee resubmission reuses
the full P1.4 validation path against the frozen planning-rules snapshot before moving back to
Submitted.

Assignment and access: manager review scope is derived from the frozen P1.2 participant approver
baseline, not live Core reporting lines. Access is deny-by-default and requires both the reused
performance.objective.team.approve permission ("Approve employee objective plans") and an employee
identity. Self-approval is blocked and surfaced as a data issue rather than a normal review task.
Cross-tenant or non-assigned review attempts fail closed.

Backend/API: Plan approvals endpoints cover campaign listing, campaign review workspace, approve,
and request changes with If-Match optimistic concurrency. Approval, change-request, and resubmission
write audit events. The audit action length was widened to safely store the new employee objective
plan review actions.

Frontend: Performance now has a distinct Plan approvals door beside My objectives and Team
objectives, with breadcrumbs through the campaign workspace. Managers review grouped queues
(Waiting for review, Changes requested, Approved), inspect the full read-only plan, approve or
request changes through a comment dialog, and view collapsed activity/history. The employee My
objectives surface now shows Changes requested with the manager comment and referenced objectives,
reopens editing, gates resubmission on dirty/fixed state plus P1.4 validation, and shows Approved as
read-only.

Boundaries preserved: no HR monitoring dashboard, no HR force validation, no reminders/reassignment
surface, no planning lock, no progress tracking, no evaluation/scoring/ratings, and no
objective-by-objective approval. P1.6 owns HR monitoring, reminders, blocker handling, reassignment,
and lock.
```

This keeps P1.5 aligned with V0's manager validation step after collaborators create and submit objectives, while keeping monitoring/lock for P1.6. The umbrella's overall P1 target still requires an approved baseline before lock, so P1.6 is the next slice.

## P1.6 — HR Monitoring, Reminders, Completion, and Planning Lock — NEXT

Purpose:

> HR monitors completion and locks planning.

Includes:

- status counts;
- overdue visibility;
- employee submission reminders;
- manager approval reminders;
- approver reassignment;
- participant exclusion with reason;
- blocker handling;
- lock validation;
- planning lock.

Lock rule:

```text
Planning can lock only when every included participant is:
Approved
or
Excluded with reason
```

Outcome:

```text
Approved objective plans become immutable and available as P2 baseline.
```

---

# 6. Not included in P1 MVP

Only things that could belong to P1 but are deliberately out of the lean P1 MVP:

```text
- objective template library;
- template categories;
- template applicability rules;
- template revisions/lifecycle;
- full enterprise strategic-objective governance;
- multi-level strategy hierarchy;
- team-objective approval workflow;
- objective-by-objective approval;
- multi-level approvals;
- peer approvals;
- administrative/forced approval;
- post-lock amendment workflow;
- complex reminder/escalation matrix.
```

We are not listing P2/P3/P4/P5/P6 features here because those are outside P1 by definition.

---

# 7. Final consolidated P1 sentence

> Lean P1 lets HR create and orchestrate a planning campaign, Direction define campaign strategy, HR select and launch the participating population, Managers translate strategy into team objectives, Employees create weighted aligned objective plans, Managers approve or request changes, and HR monitor, remind, resolve blockers, and lock the approved baseline for P2 tracking.
