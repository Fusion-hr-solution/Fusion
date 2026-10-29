---
name: performance-audit-remediation-proposed
description: "OpenSpec change performance-audit-remediation proposed 2026-07-25 from the end-to-end Performance audit; 4/4 artifacts, strict-valid, NOT implemented; locked scope + design decisions."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6b7648ee-b8cb-4f51-aee6-ced5147c2f6f
  modified: 2026-07-25T13:04:50.793Z
---

End-to-end Performance module audit written 2026-07-25 to `.local-docs/Performance/performance-module-audit-2026-07-25.md` (32 ranked findings, impact/effort/priority table, 4-sprint sequence). Gates at audit time: 429 backend + 99 frontend tests green.

Audit turned into OpenSpec change **`performance-audit-remediation`** (proposed 2026-07-25, 4/4 artifacts, `openspec validate --strict` passes, **not implemented**). 4 new capabilities (`performance-campaign-closure`, `performance-data-access-guarantees`, `performance-service-resilience`, `performance-api-error-contract`) + 9 modified.

**Four headline findings:** C1 Core HR `HttpClient` has no timeout/retry/breaker (inherits 100s default on a sync request path) · C2 `EffectiveReviewerResolver.ResolveForCampaignAsync` materialises the whole campaign population at 4 call sites · A1 nothing ever sets a terminal state — `PerformanceCycleStatus` is `{Draft,Launched}` and `EvaluationRoundStatus.Closed` is declared-but-unreachable · A2 `StrategicObjective`/`StrategicPeriod` fully orphaned (3 endpoints, 3 permissions, 0 UI, no FK from `CampaignStrategicObjective`).

**User-locked scope:** remediation only. Do NOT start the coming feature work from the specs — multi-rater/360 (A3), calibration (A4), analytics/export (A5), skill-gap→development (A8), PIP/9-box/succession (A9), attention queue (A10), i18n (C10), outbox (C5 = doc fix only) each get their own change.

**User-locked closure model:** read-only archive **+ auto-close on round finalize**.

**Design decisions worth not re-deriving** (full rationale in `design.md`):
- Auto-close runs **inline in the finalize transaction + a reconciliation sweep** — NOT a domain-event handler, because this module's events are at-most-once/best-effort and auto-close is business-critical.
- Acknowledgement does not gate auto-close (one unresponsive employee would hold the cycle open) and stays permitted after closure — the single exception to read-only.
- Closed-campaign write guard = MediatR pipeline behavior + `CampaignWriteGuard` + an **assembly-scanning coverage test**; same philosophy applied to tenant filters (convention loop + explicit exemption list + model-coverage test). Both replace clerical guarantees with structural ones.
- Closure reuses `performance.cycle.publish`; no new permission.
- A2 resolved as **delete, not wire** — tables provably empty (no UI, no access-profile grants manage/publish), drop migration guarded by an emptiness assertion. Retain `performance.strategic.view` — `CanViewCascadeCoverage` + Direction Strategy nav depend on it.
- Failures → RFC 7807 ProblemDetails; **successes keep `ApiResponse<T>`** and `SharedKernel.ApiResponse` is untouched (Identity/CoreHR/Training consume it).
- Two named Core HR resilience policies: interactive (retry) vs bulk/population (retry-free, longer timeout).
- Rate limiting in Performance, not Gateway — Gateway routes are shared with other interns' modules.
- Attachment portability via a **Postgres-backed `IAttachmentStorage`**, not S3/Blob — solves the single-replica pin with zero new infra.

**Execution guardrail baked into `tasks.md` (14 groups):** stop before git. No add/commit/push/branch/tag; leave work uncommitted for the user. See [[user-preferences-git]] pattern — user always does the final commit and PR.

Related: [[performance-evaluation-execution-overhaul]], atlas-demo-seed (archived), fusion-dual-workflow (archived).
