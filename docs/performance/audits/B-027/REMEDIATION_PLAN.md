# B-027 bounded remediation plan

This is a proposal only. No product implementation or OpenSpec artifact was changed. Start after the user chooses the two policy decisions in `RISK_AND_DECISION_REGISTER.md`.

## Slice 1 — Enforce review-subject confidentiality across combined roles

**Problem and evidence.** P0: a facilitator who is also a subject receives the full session DTO, including their own provisional rating, manager context, rationale/history and contribution to round distributions. `CalibrationFeature.cs:103-132,178-219,223-267`; `CalibrationSession.cs:36-53`; `ReviewPolicy.cs:47-54`. The approved rule is `performance-calibration/spec.md:111-123` and the pre-release review rule in `performance-reviews/spec.md`.

**Minimum behavior change.** Apply the chosen rule in the backend, across direct GET, open, facilitator assignment, subject adjustment response, session finalization response and review-detail composition. Recommended rule: retain facilitator access to the rest of the round while suppressing the actor’s own review, own outstanding row, own adjustment history, and own contribution to counts/distributions; deny adjustment of their own review. Also correct the unguarded manager-content clause in `ReviewPolicy` so a subject’s combined facilitator capability cannot reveal their own pre-release manager assessment. UI hiding is not a security fix.

**Affected areas.** `CalibrationFeature` projection and handlers; `ReviewPolicy`; possibly `CalibrationPolicy` only if the chosen rule is expressed there; `CalibrationHttpTests`, `ReviewPolicyTests`, and calibration policy tests. No new service or persisted workflow state is needed for projection-based redaction; expected migration: **none**.

**Actor behavior.** A subject-facilitator may continue facilitating other subjects under the recommendation, but receives no own provisional manager rating, calibration state/rationale/history or inferable own distribution contribution. A non-subject facilitator and authorized reviewer/admin retain their existing view. Subject-only behavior remains unchanged.

**Security/tenant/history implications.** Filter by the authenticated employee identity plus the review’s subject identity inside the server projection and command handler. Do not use display name or client flags. Keep tenant-filtered queries and current facilitator grant/seat checks. Ensure a facilitator cannot mutate their own calibration subject through a direct request.

**Verification.** Add direct HTTP tests for subject+calibrator on session open/GET, subject detail, adjust-own, adjust-other, and finalized session; assert no own record or inferable own distribution contribution. Retain tests for subject-only, admin+subject, ordinary facilitator, reviewer, revoked grant, and other tenant. Run the narrow Performance tests with the relational suite on; do not rerun the entire suite unless a concrete regression requires it. Manual walkthrough: assigned facilitator who is also one of the round’s subjects reads the session and the individual review.

**Done when.** The original subject never receives their own manager assessment before release or any own calibration detail, including by direct API and aggregate subtraction, while other authorized capabilities continue to work. Error semantics are stable and the tests exercise the combined identity.

**Recovery.** No data migration expected. If projection filtering reveals an incorrect prior result, it does not rewrite stored results; fix the server and invalidate only affected cached reads.

**OpenSpec action / size.** Original acceptance contract is unmet, so amend/fix the current unarchived change. **M (medium)** due to multiple projection and mutation response paths. Stop after tests and user review; do not begin the UI redesign.

## Slice 2 — Decide and implement the notification retry contract

**Problem and evidence.** P1: approved OpenSpec promises no duplicate notification for a retried delivery, but current SMTP send and database bookkeeping cannot commit atomically (`PerformanceBackgroundWorker.cs:41-59,97-104`; requirement at `performance-notifications/spec.md:36-45`). The audit brief says at-least-once; it does not amend the approved spec.

**Decision required.** Choose one:

1. Preserve no-duplicate semantics using a provider/transport with a documented stable idempotency key and a recovery protocol, then prove the SMTP acceptance/worker crash boundary; or
2. Amend the current OpenSpec to explicitly accept at-least-once email, including possible duplicates after provider acceptance and before outbox commit.

**Affected areas.** Notification OpenSpec requirement/design; `PerformanceBackgroundWorker`, sender/transport abstraction, outbox record only if the chosen protocol needs additional state, and `NotificationTests`/`RelationalNotificationTests`. Do not add speculative event infrastructure. Migration: **unknown until the transport/recovery choice is made**; the at-least-once option likely needs no schema change.

**Verification.** Add a deterministic fault-injection test in which the sender accepts and the worker loses process/commit before `DispatchedAt` persists. Assert the behavior selected by the user. Keep tests for bounded retries, tenant restoration, safe message content, missing email skip and durable enqueue. Run only focused notification tests with relational coverage where relevant.

**Done when.** OpenSpec wording, transport guarantee, retry state and test assertion agree. Report retry and dead-letter/skip outcomes as implemented, not as exactly-once unless proven by the provider contract.

**Recovery.** Maintain the existing outbox and bounded retry. Do not delete pending rows or resend production email during remediation. Any schema change needs a reversible migration and isolated Up/Down verification.

**OpenSpec action / size.** Either fix current acceptance or amend the current change before archive. **M (medium)** for a transport guarantee; **S (small)** for explicit at-least-once contract acceptance and honest semantics. Stop for the user if no provider can demonstrate idempotency and the user has not accepted duplicates.

## Slice 3 — Correct the review-default label

**Problem and evidence.** P2: `settings-form.tsx:144` says the toggles default “new Cycles,” but `ReviewRoundsFeature.cs:128-150` reads them when creating each new review round. A new round in an existing active Cycle also receives the current defaults.

**Change.** Rename the fieldset legend to “Review defaults for new review rounds.” No API or data-model change; migration: **none**.

**Verification.** Run Performance frontend type-check, lint and focused component tests per repo instructions; inspect the settings screen only for the corrected term, not a broader visual pass. Done when the text describes the actual default boundary and launched rounds remain unchanged.

**OpenSpec action / size.** Correct a user-facing semantic label in the current change if the exact spec names this boundary; otherwise record it as the minimal follow-on. **XS (extra small)**. Do not bundle style work.

## Slice 4 — Close the recorded concurrency proof gaps

**Problem and evidence.** Apply notes record concurrent progress writes sharing one plan-level request can require retry, and simultaneous last submissions can miss a “ready to calibrate” notice. Neither was independently reproduced in this audit.

**Change.** First add barrier-controlled relational tests. Fix only a reproduced loss or retry requirement. Preserve one satisfied transition, idempotent commands and tenant-scoped outbox state.

**Verification.** Two progress commands on separate objectives with one plan-level request; two simultaneous final assessment submissions; assert progress durability, one satisfaction record, and the approved notification outcome. No broad suite rerun absent a regression.

**Done when.** Each race has deterministic documented behavior and a passing test that exercises independent database contexts. If the behavior conforms to the approved spec already, close the evidence gap without refactoring.

**OpenSpec action / size.** If code violates an existing scenario, correct this change. If at-least-once readiness notice behavior is a new requirement, use a follow-on delta. **S–M**, depending on reproduced defect. This slice follows the user’s notification decision where the same outbox rule applies.

## Safe order and archive gate

1. User chooses facilitator/subject behavior and email retry semantics.
2. Correct and test the P0 privacy boundary.
3. Correct/amend notification semantics and test the accepted crash behavior.
4. Fix the precise review-default label.
5. Reproduce the two apply-log concurrency risks; implement only if a required invariant fails.
6. Record migration/deployment checks and update the evidence index; then reconsider archive.

OpenSpec archival remains a separate final action. Do not archive while P0 remains open, while the no-duplicate requirement conflicts with the sender contract, or while necessary migration/deployment assumptions are represented as proven without evidence. B-045’s cohesive UI/UX work remains deferred and does not need to be completed to fix the server privacy boundary.
