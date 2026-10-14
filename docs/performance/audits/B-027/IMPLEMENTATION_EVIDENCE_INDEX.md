# B-027 implementation evidence index

Audit date: 2026-10-08
OpenSpec change: `openspec/changes/establish-performance-target-state`
Implementation account: `.local-docs/agents/plans/B-027-performance-target-state-implementation-analysis.md`

## Repository and audit boundary

- Branch: `wassim/develop`; inspected HEAD: `18abc2547d852a394f382724fe5413323758a89e`.
- `git status --short` returned 324 changed paths. The Performance work is present in a large working-tree change alongside changes in other areas. There is no clean, verified B-027 commit range, so this audit describes the inspected checkout and does not attribute every changed path to B-027.
- The OpenSpec change, target-state sources, apply log, and implementation account are present. The OpenSpec CLI was not available as a command; no CLI validation result is claimed. The task file has 58/58 checkboxes marked complete; this is apply bookkeeping, not proof that every scenario was independently re-run for this audit.
- Static inventory found 24 Performance migration source files; every file defines both `Up` and `Down`. No migration was applied or rolled back and no live migration-history table was queried. `Extensions/ServiceCollectionExtensions.cs:28-42` registers the hosted outbox worker, SMTP sender and local evidence store; its root is configurable and otherwise defaults beneath the application base directory. Base `appsettings.json` disables notifications; the active environment’s effective overrides were not measured.
- No product code, OpenSpec artifact, live application data, or migration was changed by this audit. No production email was sent.

## Evidence labels

| Label | Meaning |
| --- | --- |
| **N** | Normative requirement in the refined target or approved OpenSpec. |
| **R** | Claim in the B-027 implementation account or apply log; useful lead, not proof by itself. |
| **C** | Current source code inspected. This establishes current code behavior, not deployed runtime behavior. |
| **T** | Test executed during this audit. A passing test proves only the assertions it contains. |
| **M** | Manual observation reported by the user in the conversation; not independently reproduced in this audit. |
| **U** | Not independently verified in this audit. |

## Normative sources inspected

| Source | Use |
| --- | --- |
| `.local-docs/specs/performance/target-state/refined-target-state.md` | Final product authority for bounded context, user jobs, navigation, domain ownership, authorization, history, and scope. |
| `.local-docs/specs/performance/target-state/first-principles-research.md` | Rationale behind the target; not a substitute for the refined target. |
| `openspec/changes/establish-performance-target-state/proposal.md` | Change intent and net-new versus existing-area distinction. |
| `openspec/changes/establish-performance-target-state/design.md` | Approved architecture decisions, including snapshots, privacy, lifecycle, and route decisions. |
| `openspec/changes/establish-performance-target-state/specs/**/spec.md` | Binding requirements and scenarios for the 22 capability areas. All 22 delta files were enumerated; relevant review, calibration, notification, cycle, and update-request requirements were inspected directly. |
| `openspec/changes/establish-performance-target-state/tasks.md` | Implementation checklist; 58/58 boxes are checked. |
| `.local-docs/specs/performance/target-state/apply-notes.md` | Historical decisions and unresolved/follow-on observations. It is not executable evidence. |
| `.local-docs/agents/plans/B-027-performance-target-state-implementation-analysis.md` | Reported implementation map and claims. Used as a map, not as verification. |
| User-supplied `FUSION_PERFORMANCE_B027_AUDIT_AND_AGENT_MANDATE.md` | Audit scope, evidence format, required six outputs, and stop-before-remediation/archive instruction. Its G-items were treated as hypotheses. |

## Requirement-to-code evidence map

| Requirement area | Current implementation inspected | Tests / evidence | Audit result |
| --- | --- | --- | --- |
| Cycle closure must not strand an Active review round | `Backend/EY.HRPlatform.Performance/Features/Cycles/CycleClosureFeature.cs:109-113`; `Domain/Reviews/ReviewRound.cs:26-27,83-92`; `Infrastructure/Persistence/Configurations/ReviewRoundConfiguration.cs:20` | `CycleClosureTests`; focused run below passed. | **C/T:** close is rejected while a round in the Cycle is Active; one active slot is per Cycle within tenant scope. This specific invariant is supported. Cross-command concurrency and deployed migration state remain **U**. |
| Subject/facilitator confidentiality | `Controllers/CalibrationController.cs:41-46`; `Domain/Calibration/CalibrationSession.cs:36-53`; `Features/Calibration/CalibrationFeature.cs:103-132,189-219,223-267`; `Features/Security/Policies/ReviewPolicy.cs:47-54` | `ReviewPolicyTests.cs:49-80`; `CalibrationHttpTests.cs:26-98` test separated roles, not subject+facilitator. Focused run passed but does not disprove the overlap. | **C/T:** confirmed P0 confidentiality defect; see the audit and risk register. |
| Calibration visibility contract | `openspec/.../performance-calibration/spec.md:111-123` | `ReviewPolicyTests`; `CalibrationHttpTests` | **N/C:** subjects must never receive calibration detail. Session projection has no actor-specific filtering; review policy has an unguarded facilitator path for manager content. |
| Email delivery and retry | `openspec/.../performance-notifications/spec.md:36-48`; `Infrastructure/Notifications/PerformanceBackgroundWorker.cs:23,41-59,97-104`; `PerformanceNotificationSender.cs:93-105` | `NotificationTests.cs:103-128` covers a sender failure then retry. It does not simulate SMTP acceptance followed by process failure before database commit. Focused run passed. | **N/C:** transactional enqueue and bounded retry exist, but the approved no-duplicate-on-delivery-retry requirement is not guaranteed across the SMTP/DB crash window. No duplicate was observed in this audit. |
| Review round creation and launch snapshots | `Features/Reviews/ReviewRoundsFeature.cs:128-176,341-429`; `Domain/Reviews/ReviewRound.cs`; review-round persistence configuration | `ReviewRoundsTests`, `ReviewRoundsHttpTests`; no launch journey was executed in this audit. | **C/R/U:** source shows per-round settings and subject/reviewer/configuration capture at launch. End-to-end deployment and later-source-change history behavior were not re-exercised. |
| Assessment/release visibility | `Features/Security/Policies/ReviewPolicy.cs:37-57`; `Features/Reviews/ReviewFinalizationFeature.cs:28-66`; `Features/Reviews/ReviewComposer.cs:39-72,129-181` | `ReviewPolicyTests`, `ReviewFinalizationTests`; focused run included policy tests. | **C/T:** ordinary subject and administrator visibility rules exist; the facilitator+subject intersection is defective. |
| Update request creation and satisfaction | `Features/Plans/UpdateRequestsFeature.cs:42-113`; `Domain/Plans/UpdateRequest.cs:61-69`; `Infrastructure/Persistence/Configurations/UpdateRequestConfiguration.cs` | `UpdateRequestTests`; focused run passed. | **C/T:** later progress satisfies the matching open target; one-open-per-target is backed by a unique index and duplicate handling. Historical apply notes report a concurrent plan-level satisfaction retry edge, not reproduced here (**R/U**). |
| Objective evidence storage and lifecycle | `Features/Progress/EvidenceUploadFeature.cs:19-76`; `Infrastructure/Evidence/EvidenceFileValidation.cs:3-34`; `Infrastructure/Evidence/PerformanceEvidenceStore.cs:22-73`; `EvidenceUploadSweeper.cs:9-49`; registration in `Extensions/ServiceCollectionExtensions.cs:40-42` | Evidence tests exist; none were in this focused run. | **C/U:** tenant-partitioned local storage, staged/bound uploads, a 20 MB limit, type checks, and orphan cleanup exist. Production durability, shared storage, backup, and malware scanning are unresolved deployment prerequisites, not demonstrated here. |
| Persistence and migrations | `Infrastructure/Persistence/Migrations/**`; current model snapshot; service startup configuration | Static inventory of 24 migration source files: all define `Up` and `Down`. No migration execution or live database-history query in this audit. | **C/U:** migration methods exist; their runtime success/rollback and deployment application state are unverified. |
| Tenant and object authorization | Performance controller actor construction, `ReviewPolicy`, `CalibrationPolicy`, tenant-filtered `PerformanceDbContext`, and relevant controllers | Focused calibration HTTP tests include other-tenant not-found behavior; broader authorization suite was not run. | **C/T/U:** the inspected paths apply tenant/object policy, but this audit did not independently prove the full resource matrix across every endpoint. The confirmed subject/facilitator leak remains a specific exception. |
| Review results and history | `Features/Reviews/ReviewFinalizationFeature.cs:28-66`; `ReviewRoundsFeature.cs:492-509`; review snapshot entity/configuration | Finalization tests exist; not run in the focused filter. | **C/U:** release persists a final snapshot and history derives the rating label from the frozen snapshot. Offline CoreHR behavior and all post-finalization mutation paths were not re-exercised. |
| Frontend route and API contract | `Frontend/apps/performance/src/app/(pages)/**/page.tsx`; `src/lib/performance-routes.ts`; `Frontend/packages/api/src/performance.ts:1382-1420,1460-1472`; controllers listed in `FRONTEND_BEHAVIORAL_SEAMS.md` | Route/API unit tests exist; frontend checks were not run in this audit. User-reported update-request walkthrough is **M**. | **C/M/U:** routes and typed API paths are present; no fresh browser/API journey was performed. |

## Executed verification

Command run through the repository `fusion-dev` test script:

```text
pwsh -File .agents/skills/fusion-dev/scripts/test-backend.ps1 Performance -Filter "FullyQualifiedName~ReviewPolicyTests|FullyQualifiedName~CalibrationHttpTests|FullyQualifiedName~CycleClosureTests|FullyQualifiedName~UpdateRequestTests|FullyQualifiedName~NotificationTests"
```

Result: **Performance tests | Passed 33 | Failed 0 | Skipped 0 (relational on)**.

The filter was intentionally limited to the disputed or related invariants. It does not test the missing role intersection or SMTP-accepted-then-process-crash scenario. No full backend suite, frontend type-check/lint/build, live API journey, migration Up/Down execution, live migration-history query, or rendered browser acceptance was run as part of this audit.

## Source paths for further evidence

- API controllers: `Backend/EY.HRPlatform.Performance/Controllers/ReviewRoundsController.cs`, `PerformanceReviewsController.cs`, `CalibrationController.cs`, and `EmployeePlansController.cs` (update requests).
- Typed client route/query contracts: `Frontend/packages/api/src/performance.ts`.
- Backend route and state evidence: `FRONTEND_BEHAVIORAL_SEAMS.md` and `TARGET_VS_IMPLEMENTATION_AUDIT.md`.
- Historical caveats: `.local-docs/specs/performance/target-state/apply-notes.md`, especially the final 2026-10-07 handoff entry.
