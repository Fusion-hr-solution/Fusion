# Proposal: performance-record-progress-updates

## Why

P1 ends at a locked, approved, immutable objective baseline — and then nothing happens. The Performance module currently has no way for an employee to report progress against those locked objectives, no trustworthy progress history, and no way for a manager to know which of their people need attention. This change delivers the first partition of the Performance Record (umbrella §1): the locked baseline starts living, and the operations spine (activity log, domain events, notifications, scheduled jobs, attachments) gets its first full product consumer.

## What Changes

- **Employee progress recording** against locked objectives: append-only progress updates with a required 0–100% progress value (canonical for every measurement method), an optional comment, an optional "actual result so far" for quantitative objectives (context against the frozen target, never auto-derived), and optional evidence attachments (first product UI consumer of the attachment spine).
- **Trustworthy history**: every update is immutable and shows the previous value; a lower value than the previous one is a regression requiring explicit confirmation plus a short reason; corrections happen only through a new traced update — no editing or deleting past updates, by anyone.
- **Derived objective state**: current progress, Not started / In progress / Completed (latest value = 100%), reopening (a later lower update, confirmed + reasoned), and a stale signal (no update beyond a threshold). No conflicting stored completion flag — the latest update is the truth.
- **Weighted plan progress**: Σ(latest progress × locked weight) / 100 over the approved plan, surfaced to employee and manager.
- **Employee workspace evolution**: after planning lock, the existing `My objectives` campaign workspace becomes the living progress workspace — locked baseline preserved, progress, evidence, and per-objective history added. One continuous objective story, no competing door.
- **Manager `Team progress` workspace** (new sidebar door): the participant's effective reviewer (frozen approver incl. P1.6 reassignment) sees assigned participants' plan progress, per-objective detail with full history and evidence, and attention signals (stale, recent regression, completed, not started). Read-only — follow-up actions arrive with check-ins (next partition). Separate from `Plan approvals`: approval and ongoing follow-up are different managerial jobs.
- **Spine reuse**: domain events fan out to activity-log entries and notifications (objective completed, objective reopened/regressed → effective reviewer); a scheduled stale-progress reminder job notifies employees with objectives lacking recent updates; evidence uses the attachment service end to end.
- **Permissions**: recording stays under `performance.objective.self.manage` (Self, own approved plan, post-lock only); a new team-progress view permission gates the manager door, operationally gated on actually being an effective reviewer (hide, don't deny). HR/Direction get no new surfaces — read models and events are shaped so later operational-insight work can consume them.

## Capabilities

### New Capabilities

- `performance-objective-progress`: employee-side progress recording on the locked baseline — append-only updates, percent-canonical values, regression confirmation with reason, evidence attachments, derived objective and plan progress state, staleness, the post-lock My objectives progress workspace, notifications, activity, and the stale-reminder job.
- `performance-team-progress`: effective-reviewer visibility — team progress overview per launched locked campaign, attention signals, per-objective drill-in with history and evidence, strictly read-only and scoped to assigned participants.

### Modified Capabilities

- `performance-navigation`: the `My objectives` campaign route additionally resolves to the progress workspace once planning is locked; a new `Team progress` sidebar workspace and routes (`/performance/team-progress`, `/performance/team-progress/{slug}`) are added for permitted effective reviewers.

## Impact

- **Backend (Performance :5401 only)**: new `ObjectiveProgressUpdate` entity + EF configuration + migration (`performance` schema); new Features area (commands/queries/guards/rules); new domain events + handlers (activity, notifications); new notification types; one new scheduled job; attachment owner-type integration; new permission constant in `PerformancePermissions` + access-profile seeding. Core HR is read-only truth — untouched.
- **Frontend (`Frontend/apps/performance`)**: My objectives campaign workspace gains the post-lock progress surface; new Team progress workspace pages; shared progress visuals (progress meter, history timeline, evidence upload) — promoted to `@repo/ds` only if genuinely shared.
- **Contracts**: new gateway-routed Performance endpoints; `@repo/api` performance client additions. No changes to Core, Identity, or other interns' modules.
- **Data/history semantics**: append-only table, no update/delete path (activity-log persistence pattern); locked P1 baseline is never mutated by progress.
- **Explicit non-goals (deferred per umbrella)**: check-ins and follow-up actions (next partition), HR/Direction aggregate views, expected-progress forecasting and risk formulas, HR/manager progress correction (`performance.objective.progress.correct` stays dormant), configurable staleness/thresholds UI, progress analytics pages, real-time collaboration, cycle closure.
