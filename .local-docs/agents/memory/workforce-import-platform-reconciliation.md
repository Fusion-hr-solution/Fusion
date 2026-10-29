---
name: workforce-import-platform-reconciliation
description: "Approved 2026-09-25 plan to reconcile Workforce Import onto the Org Import platform (lifecycle parity, shared semantic engine, Match/Review split, proposal fingerprint, CoreHR readiness)"
metadata:
  node_type: memory
  type: project
  originSessionId: b13a1cf8-a37c-45de-a128-dea605ab2413
  modified: 2026-09-25T12:06:17.921Z
---

Plan: `~/.claude/plans/check-the-curent-brownfield-adaptive-moon.md` (brief `.local-docs/tmp3.md`, AI decision `.local-docs/tmp2.md`). Demo file `~/Downloads/lumera-demo-workforce-80.xlsx` (80 rows, org by NAME, managers by Employee Number, 4 Inactive former workers → derived NotImported warning).

User-locked decisions:
- **Create-only**; existing employee = read-only anchor; differences → Warning, no Exclude/Keep-unchanged workaround.
- **Lifecycle parity with Org** (Active/Discarded/Committed, history folded into session, no Replace source — corrected file = new attempt, zero-create never auto-discarded).
- **Shared semantic engine** extracted from Org; Workforce adapter metadata-first PII-minimized, Suggest|Abstain, Tenant standing consent on `workforce-semantic-v1` (Org consent doesn't cover Workforce); AI never resolves entities.
- Manager NAME is never automatic identity; identity strategy decided by the identity validator (no % threshold); "generate all numbers" only on an empty tenant; lifecycle vocab Active|Former only (NotImported derived).
- Legacy migration: convert only faithful sessions, purge the rest; abort if an apply op is live.

**How to apply:** Implement in the plan's 10-step order; Org regression is the gate for shared extractions. Related: [[workforce-import-establishment-proposed]], [[org-import-stage-architecture]], [[org-import-semantic-assistance]].

**Status 2026-09-25: IMPLEMENTED, uncommitted, NOT yet rendered-verified** (CoreHR stopped by system low-memory before browser QA).
- Shared substrate: `Infrastructure/Imports/ImportPrimitives.cs` (ImportActor/Fingerprint/Origin/Severity/CompletionKind) + `Imports/Semantic/` (contracts, ImportSemanticAttempt base, ImportSemanticRunner + ConsentPolicy, domain-tagged telemetry, GroqSemanticTransport). Org re-pointed; consent table renamed `ImportSemanticConsents` (data-contract version names the domain).
- Workforce: lifecycle Active/Discarded/Committed + `PublishingStartedAt` freeze; MappingPlanJson/ResolutionsJson split; `WorkforceImportDerivation` (one chain + proposal fingerprint); issue catalog (Blocker/Warning); classifications Create/Existing/NotImported/Blocked; issue-gated resolutions; semantic adapter; publish = request-time CanPublish+fingerprint + in-tx re-derive + advisory lock; history folded into session; cohort via canonical `ImportBatchId`; `GET /corehr/setup/readiness` (CoreHRReadinessService).
- Migration `20260925124709_ReconcileWorkforceImportLifecycle` (hand-written Up; Down throws) applied to dev hris_corehr.
- FE: routes `/people/import/[sessionId]/{match,review}` + frame; shared ImportHeader/Stepper moved to `features/data-import`; old ImportShell + session orchestrator deleted.
- Gates: CoreHR 487 pass (incl. relational), scale 1k 12.6s / 10k ~6.3min; core+api typecheck clean, lint clean, vitest green (launchpad render "Welcome" test fails pre-existing).
