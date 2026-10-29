---
name: org-import-semantic-assistance
description: "Org Import AI reworked to the \"Reliable Semantic Assistance\" contract (2026-09-24) — tenant consent, upload-time run, auto-apply, abstain, eval corpus; uncommitted"
metadata:
  node_type: memory
  type: project
  originSessionId: ae9ad578-704b-4ede-99ef-cb6b68585f1c
  modified: 2026-09-24T09:51:29.506Z
---

Organization Import semantic assistance was rebuilt to the user's "Reliable Semantic Assistance" contract (pasted 2026-09-24; plan at `~/.claude/plans/golden-imagining-dewdrop.md`). Uncommitted.

**UPDATE (later same day): user overrode consent — default `ConsentMode` is `Implicit` (automatic AI matching, no consent prompt; "none of this consent bs"). `ConsentMode` switch Tenant|PerImport|Implicit still exists in options; the temporary dev select was removed.**

Original user decisions:
- **Consent = tenant standing consent** bound to tenant + provider + *data-contract version*, NOT the model (model change ≠ re-consent). First import without consent shows a concise consent affordance on Match.
- **Trigger = server during upload**, inside a hard budget (`UploadBudgetSeconds`); AI never decides upload success.

Shape of it: one strict `json_schema` call per run answering every question `Suggest|Abstain`; validated suggestions auto-applied into decisions with `SemanticSuggestion` origin (never over an Administrator decision); abstention = success; 1 bounded retry for 429/498/5xx/timeout/invalid output, never 401/403/4xx; reuse by input fingerprint + prompt/result/data versions + provider + model; attempts persist contribution counts, response id, `system_fingerprint`, `SuggestionsOverridden` (counted in `UpdateMatchAsync`). Per-item review/apply endpoint removed; single `POST {id}/semantic-assistance/run {inputFingerprint, grantTenantConsent}`. Migration `20260924…_ReliableSemanticAssistance` (+ `OrganizationImportSemanticConsents` table).

Eval corpus: `Backend/EY.HRPlatform.CoreHR.Tests/Features/OrganizationImport/SemanticEval/corpus.json` + harness; live run: `FUSION_SEMANTIC_EVAL=1 FUSION_SEMANTIC_EVAL_MODELS=a,b` (needs `GROQ_API_KEY`, user env has it), reports to `.local-docs/Core/semantic-eval/`. Groq free tier ~8k TPM shared → keep `FUSION_SEMANTIC_EVAL_PAUSE_SECONDS` ~20.

Known gaps: OpenSpec canonical spec `organization-structure-import-interpret-review-commit` still describes review-before-apply + per-file consent (not reconciled — explicit-trigger rule); deterministic resolver maps a unique name column to Business Code when a no-code file's parent column references names (eval case `no-business-code`). Related: [[org-import-stage-architecture]], [[f4a-org-import-ai-ux]].
