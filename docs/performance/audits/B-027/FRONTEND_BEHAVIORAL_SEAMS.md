# Frontend behavioral seams to preserve through the later redesign

This is a functional preservation map, not a visual specification. The route names below are under the shell’s `/performance` prefix; API calls go through the shell’s same-origin `/api` proxy. Server authorization remains authoritative.

## User job to route, contract and state

| User job | Current workspace/route | Read and command contract | State/result that must survive |
| --- | --- | --- | --- |
| Understand what needs attention and resume work | Overview: `/performance` (`src/app/(pages)/page.tsx`) | Server workspace projection supplies sections, capability destinations and record links; each link carries relevant record identity and Cycle context. | Show recorded process state and a valid destination. Do not infer a team score from missing progress. |
| Configure Cycle and population | Administration: `/performance/cycle`, `/performance/cycle/setup`, `/details`, `/population`, `/review` | Cycle and population endpoints under `/api/performance`; administrator commands create/configure/activate/close. | Draft → Active → Closed. Preserve snapshots and closure reason/exception behavior. Active review round blocks Cycle closure. |
| Plan and execute own objectives | My Plan: `/performance/plan?cycle={id}`; canonical plan `/performance/cycles/{cycleId}/plans/{planId}`; objective `/performance/cycles/{cycleId}/objectives/{objectiveId}` | Plan/objective/progress/evidence reads and employee-owned writes use typed Performance endpoints. A manager can inspect and request an update, not write the employee’s progress. | Keep Cycle/objective IDs in history links; a later active Cycle must not retarget an old record. Preserve the distinction between absent progress and recorded zero. |
| Review people and request progress | Team Performance: `/performance/team`; legacy `/performance/team/{planId}` redirects to the plan’s Cycle-addressed record | Team/Your People projection identifies reviewer-of-record and eligible actions. Create request: `POST /api/performance/cycles/{cycleId}/plans/{planId}/update-requests`; list: `GET` same path; withdraw: `POST /api/performance/update-requests/{requestId}/withdraw`. | One open request per target; whole-plan and objective targets have separate identity. Only later matching progress satisfies it. Manager request is an explicit ask, not an edit. |
| Complete self or assigned manager assessment | Reviews index `/performance/reviews`; individual record `/performance/reviews/{reviewId}` | `GET /api/performance/reviews/{id}`; self and manager assessment `PUT`/`POST /self-assessment` or `/manager-assessment`. The service computes visible fields and allowed commands. | Subject can see self-assessment throughout, manager assessment only after finalization, and released result/history. Reviewer must be the snapshotted reviewer-of-record. |
| Configure and launch a formal review round | `/performance/reviews/rounds/new`, `/performance/reviews/rounds/{roundId}/setup/{details|population|review}` and round record `/performance/reviews/rounds/{roundId}` | API routes under `/api/performance/cycles/{cycleId}/review-rounds` and `/api/performance/review-rounds/{roundId}/...`; round admin controls population, reviewer assignment, launch, status, finalize and close. | Draft → Active → Closed. Launch snapshots selected subjects/reviewers and assessment definitions; round-specific links continue to address the same Cycle and round. |
| Calibrate a round | Reviews subworkspace `/performance/reviews/rounds/{roundId}/calibration` | `/api/performance/review-rounds/{roundId}/calibration`; facilitator candidates, named seats, per-subject adjustments, rationale/history and finalization are separate typed operations. Grant and current named seat are checked by server. | Open → Finalized; changes retain actor/time/from/to/rationale. Calibration feeds final rating but never rewrites manager assessment. A subject must not receive own provisional rating or discussion through a combined role. |
| Read released result and prior reviews | Reviews history under `/performance/reviews` and Cycle-addressed record links | `/api/performance/reviews/history`; frozen review result projection. | Use stored final snapshot and rating label, not current live scale, plan or active Cycle. |
| Maintain defaults and assessment definitions | Settings `/performance/settings` | Settings, rating-scale and competency catalog typed endpoints. New round creation reads tenant review defaults; launched rounds keep chosen definitions. | A setting change seeds future rounds only; it must not rewrite an already launched round. UI label should say “new review rounds,” not “new Cycles.” |

## Route and typed API inventory

Next.js page files exist for Overview, Cycle setup, plan, team, Cycle-addressed plan/objective records, Reviews, review-round setup and detail, individual review, calibration, Settings and `/goals`. The `/goals` file remains directly addressable while the target keeps Organization Direction contextual; its final placement belongs to the cohesive B-045 review. Calibration is nested under Reviews and is not a primary navigation destination.

Relevant server controllers:

- `ReviewRoundsController.cs`: `/api/performance/cycles/{cycleId}/review-rounds`, round detail/population/launch/status/finalize/close and review work.
- `PerformanceReviewsController.cs`: `/api/performance/reviews/{reviewId}` and assessment/finalize/close commands.
- `CalibrationController.cs`: `/api/performance/review-rounds/{roundId}/calibration` and its facilitator/subject/finalize commands.
- `EmployeePlansController.cs`: Cycle plan, Team/people, approval and Update Request endpoints.
- `Frontend/packages/api/src/performance.ts:1382-1420`: matching typed paths; `1460-1472`: query keys for requests, rounds, reviews and calibration.

The frontend controls destinations and sends typed commands; it is not the policy boundary. The backend composes tenant, employee, reviewer, administrator, grant, seat and workflow-state checks.

## Behaviors the new UI must preserve

- Durable primary jobs remain Overview, My Plan, Team Performance, Reviews and Administration. Do not turn every entity/capability into a primary destination.
- A record URL carries the Cycle and record identity. Soft-open/full-page route behavior must preserve browser history and return destination.
- Server-provided action capability is a hint; every direct API read and mutation still requires server authorization.
- The same plan record is seen from employee and reviewer contexts; responsibility affects commands, not ownership of progress.
- Assessment state controls editability and visibility. “Manager submitted” is not “released.”
- Calibration is a Reviews subworkspace. Its distribution, subject context and adjustment history remain protected by role and subject boundaries.
- Update Request target (whole plan versus one objective), requester, open/withdraw/satisfied state and progress destination remain explicit.
- Missing progress and explicit zero remain different. A finalized rating comes from frozen history, not a current setting.
- Loading, error and empty states must continue to preserve the route’s record identity and let the user recover or retry safely.

## Presentation and interaction reported for later redesign

The user reported that the new Request Update interaction is awkward for both requester and receiver, “Choose objective” is practically unhelpful, and Last activity is inconsistent/confusing. The user’s walkthrough confirmed the request appeared for Nour and subsequent progress was reflected in the Team table. Those observations belong to the existing cohesive UI workstream B-045. This audit makes no pixel/layout recommendation and did not independently inspect the browser.

The old Team summary strip was rejected earlier; the apply notes say it was removed from rendering. The DTO/projection’s continued presence is not a reason to restore it. Confirm actual rendered behavior during the later UI review.
