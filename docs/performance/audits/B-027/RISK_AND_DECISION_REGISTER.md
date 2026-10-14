# B-027 risk and decision register

This register separates code-proven defects, unverified seams and product choices. The user-supplied audit mandate is not treated as an authority for changing approved behavior. The refined target and OpenSpec remain the contract.

## Confirmed defects and contract gaps

| ID | Severity | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| **R-01** | **P0** | A review subject who also has the calibration grant can become a named facilitator. Opening the session automatically names the opener (`CalibrationSession.cs:36-53`); candidate/assignment paths check the grant but not round-subject overlap (`CalibrationFeature.cs:223-267`). The returned session projection contains every calibration subject, ratings, rationale/history, distributions and outstanding review rows (`103-132`, `189-219`). Separately, `ReviewPolicy.Visibility` suppresses calibration on a subject's own review but `showManager` still allows `facilitator && ManagerAssessment.IsSubmitted` (`ReviewPolicy.cs:47-54`). This conflicts with `performance-calibration/spec.md:111-123` and the review release boundary. | **Keep** role composition for other subjects; repair server-side per-actor projection and own-target mutation checks. P0 blocks archival. No migration is indicated by the current data model. |
| **R-02** | **P1** | The approved notification requirement says a retried delivery must not notify a recipient twice (`performance-notifications/spec.md:36-45`). Worker code sends through SMTP, then marks the outbox row and commits (`PerformanceBackgroundWorker.cs:41-59,97-104`). A crash after SMTP accepts but before commit leaves the row pending. The stable Message-ID (`PerformanceNotificationSender.cs:103-105`) is not an SMTP-level deduplication guarantee. This is a demonstrated failure window, not an observed duplicate in a running environment. | Resolve the contract/transport mismatch before archive. The competing instructions are recorded below; do not silently downgrade the approved requirement. |
| **R-03** | **P2** | Settings UI says “Review defaults for new Cycles” (`settings-form.tsx:144`), while the review-round creation handler reads the current tenant settings when it creates a new round (`ReviewRoundsFeature.cs:128-150`). Those defaults can seed a new round in an already-active Cycle. | Correct the label to “Review defaults for new review rounds” or equivalent. This is a semantic accuracy fix, not a visual redesign. |

## Plausible high-risk seams not proved in this audit

| ID | Risk | Why it matters | Smallest proof |
| --- | --- | --- | --- |
| **U-01** | Concurrent progress writes can contend while satisfying one plan-level Update Request. | `apply-notes.md` records one of two concurrent objective updates failing with a changed-state response and succeeding after retry. Current handler/index behavior was not stress-tested in this audit. | Relational test with two independent contexts updating different objectives under one open plan-level request; assert both progress writes persist and the request has one deterministic satisfied transition. |
| **U-02** | Two simultaneous last assessment submissions may each miss the “all reviews reached calibration” notification. | Apply notes state readiness is computed in each transaction and the session count remains correct even if neither notification is queued. | Barrier-controlled test for concurrent final submissions; assert exactly one durable ready notification or document the intended recovery trigger. |
| **U-03** | Production evidence files may not survive multi-instance deployment, host loss, backup restore, or retention requirements. | The current implementation uses local filesystem storage. The design/apply notes list production storage and scanning as open. | Record deployment topology, retention and backup policy; run one restore/retention proof against the selected store. |
| **U-04** | Full resource authorization and historical behavior across every objective/review endpoint are not exhaustively established here. | A local test filter cannot prove all direct reads, list projections, parent-child paths, revoked actors, history and cross-tenant cases. | Use existing focused HTTP tests plus a bounded matrix for subject, reviewer-of-record, admin+subject, facilitator+subject, revoked grant, and other tenant. |
| **U-05** | Runtime migration application and rollback are not verified. | Static inventory found 24 Performance migration source files and each defines `Up` and `Down`; no operation was run and the live migration history was not queried. The dirty working tree also prevents attributing every migration to one change. | Run relational migration verification only in an isolated test database after approval. |

## Explicit source conflict requiring user disposition

The approved OpenSpec says a retried delivery **shall not** notify the same recipient twice, including a scenario that expects exactly one approval email (`performance-notifications/spec.md:36-45`). The attached audit brief's G-15 says exactly-once email is not expected and asks for at-least-once semantics. Those positions conflict. The audit brief is not an amendment to the approved requirement.

| Option | Recommendation | Tradeoff and consequence |
| --- | --- | --- |
| **A. Keep the approved no-duplicate requirement** and introduce a delivery path with a documented idempotency/deduplication contract plus recoverable outbox state. | Use only if the selected mail provider/transport can demonstrate idempotent acceptance for a stable transition key. | More integration and operational work; preserves the current approved requirement. SMTP Message-ID alone is insufficient evidence. |
| **B. Amend the OpenSpec to at-least-once email** and state that a crash after provider acceptance may result in a duplicate. | Lowest implementation cost if the product accepts occasional duplicate notices. Requires an explicit contract change before archive. | User-visible duplicates become an accepted behavior; tests should prove durable retry and report attempts/failures rather than exactly-once delivery. |

## Product decision: facilitator who is also a subject

The refined target says capabilities compose, while calibration explicitly says a subject must not see their own calibration detail. The current implementation returns an unfiltered session projection. A safe correction must cover all session read/mutation responses and aggregate fields, not just hide a button.

| Option | Recommendation | Tradeoff and consequence |
| --- | --- | --- |
| **Allow facilitation of others with self-redaction.** Omit the actor's own subject row, own outstanding review, own adjustment history and own contribution to distributions/counts; deny adjusting their own review. Also suppress their submitted manager assessment on their own review until release. | **Recommended.** It preserves composable responsibilities and the explicit subject confidentiality rule. | Requires actor-aware projection and tests for every session response; aggregates must not reveal the hidden rating by subtraction. |
| **Disallow a round subject from facilitating that same round.** | Simpler fallback if the product wants a strict separation of duties. | Reduces capability composition; the server must check at open, assignment, every read and every mutation, including subjects who reach calibration after the session opens. |

No decision was made by this audit, and no implementation was changed.

## Accepted MVP constraints and deployment prerequisites

- Calibration remains optional and nested under Reviews; no forced distribution is introduced.
- Manager assessment submission remains distinct from administrator release.
- No check-in workflow, development-planning bridge, generic workflow engine, or general BI workspace is introduced by this audit.
- Current local evidence storage is an implementation fact, not production durability approval. Production storage, backup, retention and scanning must be settled before relying on evidence in production.
- Service registration selects `LocalPerformanceEvidenceStore` using `Evidence:LocalRootPath`, falling back to an `evidence-store` directory under the application base (`Extensions/ServiceCollectionExtensions.cs:40-42`). Base `appsettings.json` disables notifications; active environment overrides were not measured. These are wiring/configuration facts, not a statement about the current running process.
- Reviewer reassignment after launch, correction of finalized reviews and email localization remain recorded OpenSpec design questions in `apply-notes.md`; this audit does not decide them.

## Later UI/UX work

The user directly reported that the manager's Request Update interaction is awkward, the employee receiver-side section is poor, “Choose objective” is not useful, and Last activity is confusing. The user also confirmed that a submitted update request appeared on Nour's plan and that progress updated the Your People data. These are manual conversation observations, not fresh browser tests. Keep them in the already consolidated UI workstream B-045. They do not establish a backend defect by themselves.
