# Tasks: performance-record-progress-updates

## 1. Domain and persistence

- [x] 1.1 Add `ObjectiveProgressUpdate` entity (append-only: identity/scope, percent, previous percent snapshot, actual value, comment, regression flag + reason, actor, UTC timestamp) with domain validation, plus new domain events (progress recorded, objective completed, objective reopened) raised from the write path
- [x] 1.2 Add EF configuration with append-only enforcement (activity-log pattern), `(ObjectiveId, CreatedAt, Id)` index, and the EF migration in the `performance` schema; extend `PerformanceNotificationType` with `ObjectiveCompleted`, `ObjectiveReopened`, `ObjectiveProgressStale`; verify with `dotnet build` + `dotnet ef migrations has-pending-model-changes` gate

## 2. Write path and derived state

- [x] 2.1 Implement the record-progress command: gating (planning locked + plan Approved + not excluded + owner + tenant), field validation (percent range, regression reason required on lower value, lengths), previous-percent snapshot under the plan's optimistic-concurrency version, attachment commit, and domain-event raising
- [x] 2.2 Implement derived-state query logic (latest-per-objective SQL): objective state (Not started / In progress / Completed), staleness vs the server-side threshold constant (default 30 days, lock time fallback), and weighted plan progress over locked weights
- [x] 2.3 Implement the employee progress workspace query (locked baseline + derived state + per-objective history with evidence) and wire endpoints through the gateway; reads never write
- [x] 2.4 Unit + integration tests: gating matrix (pre-lock, non-approved, excluded, non-owner, cross-tenant ⇒ not found), regression rules, append-only enforcement, derived-state and weighted-progress math, concurrency conflict; `dotnet test`

## 3. Spine integration

- [x] 3.1 Attachment integration: `ObjectiveProgressUpdate` owner type in `AttachmentOwnerAuthorization` (download = owning employee + current effective reviewer), atomic commit with the update, no-commit on validation failure; tests
- [x] 3.2 Domain-event handlers: activity-log entry per recorded update (value transition metadata); deduplicated reviewer notifications for completion and confirmed reopening with contextual routes; duplicate-safe; tests
- [x] 3.3 `StaleProgressReminderJob` on the shared runner: stale detection over locked campaigns, per-objective/window dedup, employee notifications; tests

## 4. Team progress backend

- [x] 4.1 Add `PerformancePermissions.ObjectiveProgressTeamView` (`performance.objective.progress.team.view`), seed into the Manager access profile
- [x] 4.2 Implement reviewer queries reusing the effective-reviewer resolution (frozen approver + latest reassignment): my team-progress campaigns, campaign team workspace (participants, weighted progress, attention signals, attention-first ordering), participant objective history detail — all read-only, deny-by-default, empty-state-truthful without scope; tests incl. reassignment visibility move and cross-tenant not-found; `dotnet test`

## 5. Employee frontend — My objectives evolution

- [x] 5.1 Add `@repo/api` performance client functions + types for the new endpoints (employee workspace, record update, team progress, history)
- [x] 5.2 Build the post-lock progress workspace in the campaign My objectives route (new components under `components/my-objectives/progress/`, not the existing page monolith): weighted-progress hero with display-weight numeral, per-objective cards with locked baseline context, derived state, staleness, and record action; pre-lock P1 states untouched; terminology via the single terms source
- [x] 5.3 Build the record-progress dialog: visible previous value, percent control (slider + numeric), comment, actual-result (quantitative only), evidence upload against the real pending/commit flow, inline regression confirmation + reason on lower values, field-error preservation, no-refresh workspace update on success
- [x] 5.4 Build the per-objective append-only history timeline (value transitions with delta, regression reasons, comments, actual results, evidence downloads, actor, time; no edit/delete affordances)
- [x] 5.5 Component tests for workspace states (pre-lock unchanged, locked-approved progress, not-locked notice, empty, denied, error) and dialog rules; `pnpm --filter performance test`

## 6. Manager frontend — Team progress workspace

- [x] 6.1 Add the `Team progress` sidebar door (permission + effective-reviewer operational gate, hide-don't-deny), routes `/performance/team-progress` and `/performance/team-progress/{slug}`, breadcrumbs, and the campaign list door page with truthful empty state
- [x] 6.2 Build the attention-first campaign team workspace: participant rows with weighted progress and named attention signals (stale, recent regression, not started) conveyed by shape + text, calm completed grouping, read-only objective drill-in reusing the history timeline with evidence download
- [x] 6.3 Component tests for scope gating, ordering, signals, empty/denied/error states; `pnpm --filter performance test`

## 7. Verification and finish

- [x] 7.1 Seed the Atlas demo tenant with realistic post-lock progress histories (fresh, stale, regressed, completed, untouched) so both workspaces demo the narrative — seeded the locked Atlas cycle "FY26 Performance Planning": minted `sami.analyst@atlasgroup.tn` (Employee profile) for the approved plan owner, backdated 8 updates across the 4 objectives (completed / fresh / stale@40d / not-started + a confirmed regression), reviewer = Flit Manager; cleared 3 stale garbage P1.6 reassignments that had detached the participants
- [x] 7.2 Full gates: `dotnet build` + `dotnet test`, migration gate, `pnpm lint`, `pnpm type-check`, `pnpm --filter performance test`, frontend build
- [x] 7.3 Rendered verification through the shell (`:3000`), impeccable-level: employee ProgressWorkspace (display-weight 51%→54% hero, per-objective meters, Completed/In progress/Needs-update/Not-started derived states, locked-baseline note), record dialog (slider+numeric, actual result, comment, evidence Attach file), manager Team-progress workspace (attention-first, "1 not started · 1 stale · Recent setback" signals), manager participant drill-in (append-only timeline with ↗/↘ deltas + highlighted regression reason), bell badge, light + dark + mobile — all verified with live data. Backend live smoke caught + fixed a real bug: `ObjectiveProgressTeamView` had no `CorePermissionDefinition`, so token generation 500'd on any manager grant (would break every fresh tenant provision); added the definition (DirectReports/OrgUnit/Tenant scopes). Restarting Identity confirmed the Manager-template edit auto-backfills existing tenants' Manager profiles.
- [x] 7.4 Playwright journey: as Sami, recorded "Improve delivery quality" 90%→100% with an evidence file through the real dialog → objective flipped to Completed (green meter + badge), hero recalculated 51%→54% with no manual refresh, history incremented to 4 with evidence linked, and Flit received exactly one `ObjectiveCompleted` notification (bell). Evidence upload → pending → claim-on-record path exercised end-to-end.
- [x] 7.5 `openspec status` review — user approved commit and push on `feature/performance-operations-spine`, stacked on L5 #514 per `.local-docs/github/open-pr-stack.md`
