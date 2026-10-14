# B-027 OpenSpec archival readiness

## Remediation update (B-054, 2026-10-08)

The backend and contract blockers below are resolved in the working tree. The original audit text is kept as the record of what was found.

| Finding | Resolution | Evidence |
| --- | --- | --- |
| P0 subject/facilitator confidentiality (R-01) | Actor-specific self-redaction. The session projection drops the caller's own review from subjects, history, outstanding, counts and distribution (`CalibrationSessions.ProjectAsync`); adjusting one's own review is forbidden; the round list counts and the administrator's round rating distribution exclude the caller's own review; `ReviewPolicy` no longer lets the facilitator clause reach one's own review; finalization responses null `finalRatingSource` for the caller's own review. New requirement in `performance-calibration/spec.md`. | `CalibrationHttpTests.A_facilitator_who_is_also_a_subject_…` (open, read, adjust-own 403, adjust-other, list, status, finalize, release); `ReviewPolicyTests` facilitator-subject case. |
| P1 notification retry contract (R-02) | Contract amended to at-least-once email: no second notification from a retried command; a notification is never lost and is resent only after a stop between mail-server acceptance and the dispatch commit, with the same Message-ID. SMTP has no idempotent-accept contract, so exactly-once is not claimable. `performance-notifications/spec.md` + design §10. | `RelationalNotificationTests.A_crash_after_the_mail_server_accepts_…` |
| P2 Settings label (R-03) | “Review defaults for new review rounds”. | Performance type-check, lint, 112 tests. |
| U-01 concurrent progress under one plan-level request | Reproduced (second progress write failed as changed). Fixed: `UpdateRequestSatisfaction.SaveAsync` drops the lost satisfaction claim and its audit entry, so the progress still saves; the request is satisfied once. | `UpdateRequestRelationalTests.Concurrent_progress_…` fails without the fix, passes with it. |
| U-02 simultaneous last submissions | Reproduced (no ready notice). Fixed: `CalibrationSessions.ConfirmReadyAfterCommitAsync` re-checks after commit; session version and outbox dedupe let exactly one notify. | `CalibrationRelationalTests.Simultaneous_last_submissions_…` fails without the fix, passes with it. |
| U-05 migrations | All migrations apply, roll back to an empty schema, re-apply; no pending model changes. Isolated test database only. | `RelationalTests.Every_migration_rolls_back_to_empty_and_reapplies` |

Final checks: Performance backend 365 passed / 0 failed / 1 skipped (opt-in Mailpit), relational on; `@repo/api` type-check + 115 tests; Performance type-check, lint, 112 tests.

Still open and not code defects: production evidence storage, backup, retention and scanning (B-053, deployment prerequisite); the full cross-endpoint authorization matrix beyond the combined-role cases (U-04); reviewer reassignment after launch, correction of finalized reviews and email localisation (design open questions). UI/UX remains B-045.

**Updated verdict:** ready to archive once the user accepts the two contract decisions (self-redaction and at-least-once email).

## Verdict (original audit)

**Not ready to archive.** The inspected checkout contains a confirmed P0 review confidentiality defect and a P1 mismatch between the approved no-duplicate notification requirement and the SMTP/outbox crash window. The OpenSpec task list is complete on paper (58/58 boxes checked), but that does not override these verified code/spec differences.

## Scenario evidence summary

| Area | Evidence status |
| --- | --- |
| Cycle cannot close while an Active review round remains open | Code and focused tests support the sequential guard. Simultaneous launch/close and applied migration state remain unverified. |
| Review subject/facilitator intersection | **Fails.** Session DTO returns all subjects; review policy’s facilitator branch exposes submitted manager assessment on the subject’s own review. Existing tests do not exercise the combined identity. |
| Subject result redaction after release | Ordinary subject path is covered by existing ReviewPolicy and Calibration HTTP tests; focused filter passed. Combined facilitator case is not safe. |
| Update Request target and later-progress satisfaction | Handler/model and focused tests support the ordinary state transition. Concurrent request/progress races recorded in apply notes remain unverified. |
| Notification enqueue, tenant context, safe content and ordinary transport retry | Outbox and focused tests support these paths; 33 filtered tests passed with relational tests on. |
| No duplicate delivery after SMTP acceptance and worker crash | **Not demonstrated and not guaranteed by current code.** It conflicts with the approved spec’s no-duplicate requirement. |
| Frozen final result/history after upstream edits or outage | Snapshot model exists in source; post-change/outage scenario was not run during this audit. |
| Full API/object/tenant authorization matrix | Only focused review/calibration paths were exercised; full matrix is not established. |
| Frontend routes and user interactions | Route and typed API source inspected; no fresh frontend checks/browser journey. User’s prior update-request walkthrough is reported evidence, not this audit’s reproduction. |
| Migrations and deployment assumptions | Static inventory found 24 migration source files, each defining `Up` and `Down`; no migration operation was executed and live migration history was not queried. Service registration uses a configurable local evidence root with an application-base fallback; production shared storage, backup, retention, scanning and active environment overrides remain unverified. |

## Archive blockers

1. Correct the P0 subject/facilitator confidentiality defect across session projections, review detail, distributions, outstanding rows and adjustment responses.
2. Resolve the notification contract conflict and prove the selected retry semantics at the SMTP-accepted/process-crash boundary.
3. Record the relevant migration and deployment assumptions without claiming they were exercised if they were not.

The incorrect “Review defaults for new Cycles” label is a bounded P2 accuracy issue recommended for correction. The two apply-log concurrency reports need targeted proof; whether they block archive depends on the reproduced result and their exact approved requirements. Visual redesign, update-request interaction polish, Last activity presentation, and final placement of `/goals` belong to the already deferred cohesive UI workstream and are not reasons to redesign before fixing the backend privacy defect.

## Migration and deployment check

Partially checked statically. All 24 Performance migration source files declare both `Up` and `Down`, but the audit did not execute either path or query live database migration history. Runtime registration uses the local filesystem evidence implementation with a configurable root and app-base fallback; production shared storage, backup, retention and scanning remain unresolved. Base configuration disables notifications, but active environment overrides were not measured. Do not interpret the 33 focused test result as deployment certification.

## Final recommendation

**Archive after named fixes and evidence**, not now. The named fixes are the two blockers above, plus targeted proof of the recorded concurrency seams and migration/deployment notes. After those changes, re-run the narrow affected tests, update the requirement map, and ask for human review of the corrected contract. Do not archive as a side effect of preparing this report.

## Audit artifacts

- [Evidence index](IMPLEMENTATION_EVIDENCE_INDEX.md)
- [Target versus implementation audit](TARGET_VS_IMPLEMENTATION_AUDIT.md)
- [Risk and decision register](RISK_AND_DECISION_REGISTER.md)
- [Frontend behavioral seams](FRONTEND_BEHAVIORAL_SEAMS.md)
- [Remediation plan](REMEDIATION_PLAN.md)
- [Archival readiness](ARCHIVAL_READINESS.md)

No implementation, OpenSpec change, migration, live data or archival action was performed during this audit.
