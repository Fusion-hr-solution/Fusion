# Phase 4: Peer/Upward Feedback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 4-peer-upward-feedback
**Areas discussed:** Response model, Anonymity architecture, Threshold suppression, Mutability, Anonymity cohort, Release timing, Moderation/invalidation

---

## Response Model

| Option | Description | Selected |
|--------|-------------|----------|
| Single free-text | One narrative field per response. Simple, aligns with 'narrative-only for MVP.' | |
| Structured sections | Predefined sections (strengths / improvements / general). More guidance but adds complexity. | |
| Template-driven ordered prompts | Multiple ordered narrative answers from a frozen configurable template, optional general comment, validate required prompts, preserve prompt text/version. | ✓ |

**User's choice:** Template-driven ordered prompts — one response per work item, multiple ordered narrative answers defined by the campaign's frozen feedback template. Prompts configurable, not hardcoded. Narrative-only. Optional general comment. Validate required prompts. Preserve prompt text/version for historical integrity.

---

## Anonymity Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Hard separation | Two tables: FeedbackResponseContent (no reviewer FK) + FeedbackIdentityMapping (ResponseId → WorkItemId → ReviewerEmployeeId). Content table literally cannot identify the reviewer. | ✓ |
| Same table, soft guard | FeedbackResponse has ReviewerEmployeeId but access is policy-gated. Simpler but identity is in the same table. | |

**User's choice:** Hard separation with opaque ResponseId. FeedbackResponseContent has no ReviewerId and no reviewer-identifying WorkItemId. FeedbackIdentityMapping stored separately with stricter authorization. Normal retrieval never joins identity. Campaign ownership alone doesn't permit identity disclosure. Identity resolution only for authorized exceptional purposes, audited. Submission writes both atomically but content and identity independently access-controlled.

---

## Threshold Suppression

| Option | Description | Selected |
|--------|-------------|----------|
| Subject sees nothing | Subject cannot see ANY feedback below threshold. Manager and HR can still see individual responses. | |
| Fully hidden from all non-HR | Neither subject nor manager sees feedback below threshold. Only HR admins can access. | |
| Subject sees aggregate only | Subject sees summary/aggregate but not individual responses when below threshold. | |

**User's choice:** Hard suppression — when cohort below threshold, suppress ALL content from normal consumers (subject, manager, campaign owner). They see only "insufficient responses to preserve anonymity." Not individual responses, summaries, reviewer identities, or exact response count. Only explicitly authorized privacy/compliance administrator may access suppressed content for exceptional purposes. Reviewer identity requires separate elevated permission, every exceptional access audited. Once threshold met, release per visibility policy. Never reveal identity through ordering/metadata.

---

## Feedback Mutability

| Option | Description | Selected |
|--------|-------------|----------|
| Submit-only, no edits | Once submitted, feedback is immutable. Simple, audit-friendly. | |
| Edit before deadline | Reviewer can edit until campaign feedback window closes. More user-friendly but adds versioning complexity. | |
| Withdraw only | Reviewer can withdraw (delete) but not edit. Middle ground. | |

**User's choice:** Three-state lifecycle: Draft (save/edit) → Submitted (revise/withdraw while window open) → Locked (immutable after window close/campaign finalize). Every revision creates append-only version history, never overwrite. Withdrawal is soft status change, not deletion, removes from anonymity threshold count. After lock, only authorized administrative correction with reason, preserved history, governance audit.

---

## Anonymity Cohort

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type per-subject | Anonymity group = all responses for one subject + one feedback type (Peer or Upward) within a campaign. Threshold per-type per-subject. Peer and upward independent cohorts. | ✓ |
| Combined across types | All peer AND upward responses for one subject combined. Single threshold across both types. | |

**User's choice:** Per-type per-subject. Peer and upward are independent cohorts with independent threshold counts.

---

## Release Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate on threshold | Feedback released to eligible consumers as soon as cohort reaches threshold, even while window is open. Real-time accumulation. | ✓ |
| Batch at window close | All feedback held until window closes, then released at once if threshold met. | |
| Hybrid (first trigger) | Release at threshold OR window close, whichever comes first. | |

**User's choice:** Immediate on threshold. Content released as soon as cohort reaches minimum threshold, even while feedback window is open.

---

## Moderation & Invalidation

| Option | Description | Selected |
|--------|-------------|----------|
| Withdraw removes count, invalidation keeps count | Withdrawn soft-deleted and removed from count. Invalidated flagged but still count toward threshold. HR can invalidate with reason + audit. | ✓ |
| Both remove from count | Both withdrawn and invalidated removed from threshold count. More reviewer-friendly but vulnerable to gaming. | |
| Neither affects count | Count based on total assigned reviewers who submitted, regardless of status. | |

**User's choice:** Count only valid, non-withdrawn responses toward threshold. Empty required answers rejected at submission. Withdrawn soft-withdrawn and removed from count. Abusive/duplicate/invalid administratively invalidated with mandatory reason, removed from count. Preserve all content/status history for audit, never hard-delete. Final threshold evaluated at window close — if withdrawals/invalidations leave cohort below threshold, suppress entire cohort. Prevent gaming through authorization, lifecycle limits, auditing — not by counting unusable feedback.

---

## the agent's Discretion

- Exact entity/table shapes, command/query names, endpoint routes, DTO shapes, EF configurations, and which existing tests to extend vs add — delegated to the agent (D-19).

## Deferred Ideas

- Spontaneous feedback (P4-02 in spec) — out of scope for Phase 4; campaign-assigned only.
- Forbidden words / content filtering (P4-01 in spec) — moderation layer for future phase.
- Karma score / gamification — out of scope for Packet A.
- Exception resolution handlers — Phase 5 (`REQ-exception-owner`).
