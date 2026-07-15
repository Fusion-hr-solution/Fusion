## Why

P1.5 produces approved, returned, and pending employee objective plans, but HR still has no authoritative way to close the planning campaign. P1.6 completes P1 by giving HR a participant-based completion workspace, lightweight reminder history, blocker resolution, and a deliberate planning lock that freezes the approved baseline for P2.

## What Changes

- Add an HR planning completion workspace for launched campaigns, based on the frozen P1.2 participant and approver baseline.
- Compute participant completion groups: Not started, Draft, Submitted, Changes requested, Approved, Excluded, and Blocked.
- Surface overdue and reminder-needed indicators using existing planning schedule dates where available, without creating a full notification platform.
- Add lightweight reminder actions/history so HR can record or optionally trigger follow-up for employees, managers, or blocker owners.
- Add campaign-specific blocker resolution:
  - reassign a participant's campaign approver with a required reason, without changing Core reporting lines or recomputing from live Core;
  - exclude a participant from the lock requirement with a required reason, without deleting or rewriting the frozen participant baseline.
- Add lock readiness validation: every frozen participant must be Approved or Excluded with reason.
- Add a deliberate planning lock action with confirmation, audit, lock actor/timestamp, and read-only post-lock campaign monitoring.
- Enforce post-lock immutability across normal P1 flows: employee objective editing/resubmission and manager approval/change-request actions are blocked after lock.
- Keep out of scope: HR force approval, full notification inbox/bell/email/template/preference/retry infrastructure, post-lock amendments, P2 progress tracking, scoring, evaluations, ratings, 360 feedback, and P2/P6 dashboards.

## Capabilities

### New Capabilities

- `performance-planning-completion-lock`: HR monitors completion for every frozen participant, records reminder readiness/history, resolves blockers through campaign-specific reassignment or exclusion, validates lock readiness, and locks planning as the P2 baseline handoff.

### Modified Capabilities

- `performance-campaign-population-launch`: launched campaign participant and approver baselines remain historically frozen while P1.6 adds campaign-specific post-launch review-assignment adjustments and participant lock exclusions as separate traceable closure data.
- `performance-employee-objective-plan`: approved and returned/draft plans must respect planning lock, with normal employee authoring and resubmission blocked after lock.
- `performance-plan-approval`: manager approve/request-changes actions must be blocked once planning is locked, and reassigned approvers must receive pending review responsibility through campaign-specific P1.6 reassignment.
- `performance-navigation`: HR gets a distinct planning completion/lock workspace with route, sidebar, breadcrumbs, permission behavior, and truthful empty/denied states.

## Impact

- Backend Performance domain: campaign lock state, participant closure/exclusion state, campaign-specific approver reassignment history, reminder history, lock validation service, audit actions, migrations, and tenant-scoped APIs.
- Existing P1.1-P1.5 flows: campaign launch remains the source of the frozen participant baseline; employee plan submission/resubmission and manager approval continue until planning lock, then become immutable through normal P1 routes.
- Identity/access: reuse existing tenant-scoped campaign permissions where possible, with explicit checks for view, blocker-resolution, reminder, and lock actions; deny by default and no Core reporting-line mutation.
- Frontend Performance app: add an HR completion workspace under the campaign/HR surface, using `@repo/ds`, app-shell navigation, breadcrumbs, responsive desktop/mobile layouts, light/dark verification, and compact operational UX.
- Shared frontend contracts: extend `@repo/api` Performance DTOs and `@repo/auth` access helpers only where needed for route visibility and API typing.
- Tests and verification: domain, handler/controller, auth, API contract, frontend component tests, OpenSpec validation, EF migration pending-model check, and rendered Playwright verification through the shell.
