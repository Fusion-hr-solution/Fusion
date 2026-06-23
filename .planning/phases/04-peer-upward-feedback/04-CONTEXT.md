# Phase 4: Peer/Upward Feedback - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build narrative peer/upward feedback as a privacy-correct, owner-curated input — the
response submission/retrieval that is currently missing from the campaign engine.

This is a **BUILD** phase. It owns 1 requirement: **REQ-peer-upward-feedback**.

The product-direction decisions (owner-curated matrix, narrative-only, anonymity by
design, minimum-response threshold) are **already locked** by the authoritative decisions
in PROJECT.md / `.planning/intel/decisions.md`. This phase clarifies HOW to implement,
not WHAT.

</domain>

<decisions>
## Implementation Decisions

### Feedback Response Model
- **D-01: One response per assigned work item.** Each `CampaignWorkItem` of type
  `PeerFeedback` or `UpwardFeedback` maps to exactly one `FeedbackResponse`. The
  reviewer writes narrative answers against the campaign's frozen feedback template.
- **D-02: Template-driven prompts, not hardcoded.** The campaign's frozen feedback
  template defines ordered prompts (e.g., strengths, development areas, tenant-specific
  questions). Prompts are configurable, not hardcoded per feedback type. The template is
  frozen at publish and versioned for historical integrity.
- **D-03: Narrative-only, no scoring.** Responses contain narrative text answers per
  prompt. No ratings, weights, or independent scores. An optional general comment field
  is allowed per response.
- **D-04: Prompt text preservation.** Each response preserves the exact prompt text and
  version it was submitted against. This ensures historical integrity when templates
  evolve across campaigns.

### Anonymity Architecture
- **D-05: Hard separation with opaque ResponseId.** Two independent storage surfaces:
  - `FeedbackResponseContent`: ResponseId (opaque), campaign/subject/type, frozen prompts
    and answers, status/timestamps — **no ReviewerId and no reviewer-identifying
    WorkItemId**.
  - `FeedbackIdentityMapping`: ResponseId → WorkItemId → ReviewerEmployeeId — stored
    separately with stricter authorization.
- **D-06: Retrieval never joins identity.** Normal feedback retrieval queries only
  `FeedbackResponseContent`. The identity mapping is never joined in ordinary read paths.
  Campaign ownership alone does not permit identity disclosure.
- **D-07: Exceptional identity resolution is audited.** Identity resolution is permitted
  only for explicitly authorized exceptional purposes (e.g., compliance investigation).
  Every exceptional access requires a separate elevated permission and emits a governance
  audit event.

### Anonymity Cohort
- **D-08: Per-type per-subject cohort.** An anonymity cohort is defined by
  campaign + subject + feedback type (Peer or Upward). Peer and upward are independent
  cohorts with independent threshold counts. The minimum-response threshold applies
  per-cohort.

### Threshold Suppression
- **D-09: Hard suppression below threshold.** When a cohort is below its minimum
  threshold, ALL feedback content is suppressed from normal consumers — subject, manager,
  and campaign owner. They see only a message indicating insufficient responses to
  preserve anonymity. They do NOT see individual responses, summaries, reviewer
  identities, or the exact response count.
- **D-10: Narrow compliance override.** Only an explicitly authorized privacy/compliance
  administrator may access suppressed content for exceptional operational or
  investigative purposes. Reviewer identity resolution requires a separate elevated
  permission. Every exceptional access emits a governance audit event.
- **D-11: Threshold evaluated at window close.** The final anonymity threshold is
  evaluated when the feedback window closes. If withdrawals or invalidations leave the
  cohort below threshold at that point, the entire cohort is suppressed. This prevents
  gaming through late withdrawals.

### Release Timing
- **D-12: Immediate release on threshold.** Feedback content is released to eligible
  consumers (subject, manager per visibility policy) as soon as the cohort reaches the
  minimum threshold, even while the feedback window is still open. Consumers see responses
  accumulate in real-time as the threshold is met.

### Feedback Mutability (Lifecycle)
- **D-13: Three-state lifecycle.** Each response progresses through:
  - **Draft**: reviewer may save and edit freely. Not counted toward threshold.
  - **Submitted**: reviewer may revise or withdraw while the feedback window remains open.
    Counted toward threshold.
  - **Locked**: once the feedback window closes or the campaign finalizes, content becomes
    immutable.
- **D-14: Append-only revision history.** Every revision creates an append-only version
  record; prior content is never overwritten. The latest version is the active response.
- **D-15: Soft withdrawal, not deletion.** Withdrawal is a status change, not a hard
  delete. Content is preserved in history for audit. Withdrawn responses are removed from
  the anonymity threshold count.

### Moderation & Invalidation
- **D-16: Submission validation.** Empty required prompt answers are rejected at
  submission time — the reviewer cannot submit a response with unfilled required prompts.
- **D-17: Administrative invalidation.** Abusive, duplicate, or otherwise invalid
  responses may be administratively invalidated with a mandatory reason. Invalidated
  responses are removed from the threshold count. Content and status history are preserved
  for audit — never hard-deleted.
- **D-18: Gaming prevention.** Prevent threshold gaming through authorization controls,
  lifecycle limits, and auditing — not by counting unusable feedback. The combination of
  D-11 (evaluate at window close), D-13 (draft not counted), D-15 (withdrawal removes
  count), and D-17 (invalidation removes count) forms the anti-gaming surface.

### Audit Events
- **D-19: Feedback-specific audit actions.** New `PerformanceCycleAuditAction` values
  for: FeedbackResponseSubmitted, FeedbackResponseWithdrawn, FeedbackResponseLocked,
  FeedbackThresholdReached, FeedbackSuppressed, FeedbackContentAccessed (exceptional),
  FeedbackIdentityAccessed (exceptional), FeedbackResponseInvalidated. Every submission,
  withdrawal, threshold crossing, suppression, and exceptional access emits an audit
  event.

### Claude's Discretion
- Exact entity/table shapes, command/query names, endpoint routes, DTO shapes, EF
  configurations, and which existing tests to extend vs add — Claude's call, provided
  D-01…D-19 hold and the demo path + guardrail tests are covered.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec (source of truth for acceptance criteria)
- `.local-docs/Performance/Perf SPEC V0.md` — Packet A spec; §6 (Feedback process)
  defines the explicit "must / do not / validate" language for peer/upward feedback.
- `.local-docs/Performance/Packet A/Performance Module Packet A Reasearch & Product Direction.md`
  — product-direction research underpinning the decisions; § 360/anonymity section
  covers architectural anonymity requirements.

### Requirements & authoritative decisions
- `.planning/REQUIREMENTS.md` — 16 v1 requirements; Phase 4 owns REQ-peer-upward-feedback.
- `.planning/intel/decisions.md` — 14 authoritative decisions (locked; not re-litigated).
  Key for Phase 4: `DEC-peer-upward-curated`, `DEC-retention-policy-required`,
  `DEC-deny-by-default-authorization`, `DEC-ownership-boundaries`.
- `.planning/intel/constraints.md` — NFR/protocol constraints (deny-by-default authz,
  tenant fail-closed, append-only audit, privacy-by-design).

### Prior phase context (carry-forward decisions)
- `.planning/phases/02-campaign-lifecycle-snapshot-verification/02-CONTEXT.md` —
  Evidence standard (D-03/D-04/D-05) and divergence-handling discipline carried forward.
- `.planning/phases/03-objective-cascade-completion/03-CONTEXT.md` — Work-item pattern
  reuse (D-09/D-10), authorization pattern (D-15), evidence standard (D-17/D-18/D-19).

### Codebase grounding (brownfield maps)
- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md`, `STRUCTURE.md`, `TESTING.md`,
  `INTEGRATIONS.md`, `CONCERNS.md`, `STACK.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CampaignWorkItem entity** (`Domain/Entities/CampaignWorkItem.cs`): Already has
  `PeerFeedback` and `UpwardFeedback` work item types, plus a full lifecycle
  (Assigned → InProgress → Submitted → Completed/Cancelled). New feedback response
  entity should link to this work item.
- **CampaignAssignmentResponsibility** (`Domain/Entities/CampaignAssignmentResponsibility.cs`):
  Assignment matrix with `Confirm()` and `Supersede()`. Currently only supports
  `ObjectiveApproval` and `ManagerReview` duties — will need `PeerFeedback` and
  `UpwardFeedback` duty values added to `CampaignResponsibilityDuty`.
- **PerformanceCycle governance** (`Domain/Entities/PerformanceCycle.cs`): Already has
  `MinimumAnonymousFeedbackResponses` (default 3), `FeedbackVisibility`
  (AnonymousToSubject/VisibleToSubject), and frozen variants. Governance is frozen at
  publish via `BeginAssignmentPreparation()`.
- **CampaignFeedbackVisibility enum** (`Domain/Enums/CampaignFeedbackVisibility.cs`):
  `AnonymousToSubject` / `VisibleToSubject` — already defined, used in cycle governance.
- **PerformanceCycleAuditEvent** (`Domain/Entities/PerformanceCycleAuditEvent.cs`):
  Append-only audit with Outcome + CorrelationId. New feedback-specific actions extend
  `PerformanceCycleAuditAction`.
- **PerformanceAccessPolicyService** (`Features/Security/PerformanceAccessPolicyService.cs`):
  Deny-by-default authorization — use for identity-access permission checks (D-07/D-10).
- **CampaignWorkItem lifecycle**: `Begin()`, `Submit()`, `Complete()`, `Cancel()` — the
  Draft → Submitted → Locked pattern from D-13 can build on or mirror this state machine.

### Established Patterns
- Vertical Slice + CQRS via MediatR; controllers dispatch via `ISender`; handlers return
  `Result<T>` (do not throw for expected business failures).
- One DbContext, one `performance` schema; new entities via
  `Infrastructure/Persistence/Configurations/<Entity>Configuration.cs` (assembly scan,
  never hand-edit `OnModelCreating`) + DbSet + `dotnet ef migrations add`.
- Work-driven flow: business actions gated on `CampaignWorkItem`s — reuse for feedback
  work items.
- Tests mirror source path under `EY.HRPlatform.Performance.Tests/`.

### Integration Points
- **Feedback template**: A new `FeedbackTemplate` entity (frozen at publish) defines the
  ordered prompts. This is campaign-scoped and snapshotted with governance.
- **Feedback response content**: New entity `FeedbackResponseContent` (no reviewer FK)
  linked to work item via opaque ResponseId.
- **Feedback identity mapping**: New entity `FeedbackIdentityMapping` (ResponseId →
  WorkItemId → ReviewerEmployeeId) with separate authorization.
- **Threshold evaluation**: Logic to count valid submitted responses per cohort
  (campaign + subject + type) and compare against frozen
  `MinimumAnonymousFeedbackResponses`.
- **Window close trigger**: Feedback window close is tied to campaign lifecycle or a
  dedicated feedback deadline — evaluate threshold at that point (D-11).

</code_context>

<specifics>
## Specific Ideas

- Governing lens for evidence (carried from Phase 2/3): backend-only milestone, so the
  "demo" = driving the API through feedback submission, retrieval under visibility policy,
  threshold suppression, and showing the guardrails hold. Anything demo-visible is
  test-backed.
- The user explicitly wants the anonymity-cohort and threshold mechanics to be
  architecturally enforced, not cosmetic. Hard separation (D-05/D-06) and suppression
  (D-09/D-10) are non-negotiable.

</specifics>

<deferred>
## Deferred Ideas

- **Spontaneous feedback (P4-02 in spec)** — the spec describes "spontaneous feedback"
  (unsolicited, not campaign-assigned). This is out of scope for Phase 4; Phase 4 builds
  only campaign-assigned peer/upward feedback. Spontaneous feedback is a separate
  capability for a future phase.
- **Forbidden words / content filtering (P4-01 in spec)** — the spec describes offensive
  content detection and HR moderation. This is a moderation layer that can be added later;
  Phase 4 focuses on the core response/anonymity/threshold mechanics.
- **Karma score / gamification** — out of scope entirely for Packet A.
- **Exception resolution handlers** (reassign/override/return/cancel routed items) →
  **Phase 5** (`REQ-exception-owner` BUILD).

</deferred>

---

*Phase: 4-peer-upward-feedback*
*Context gathered: 2026-06-23*
