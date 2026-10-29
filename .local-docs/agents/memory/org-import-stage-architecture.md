---
name: org-import-stage-architecture
description: "Organization Import locked architecture — Upload → Match[conditional] → Review routes; stage derived from product readiness, never AI lifecycle; Review owns publish"
metadata:
  node_type: memory
  type: project
  originSessionId: b13a1cf8-a37c-45de-a128-dea605ab2413
  modified: 2026-09-23T08:52:55.636Z
---

Org import (`/core/organization/import`) is locked (2026-09-23) as one attempt with 3 user-facing stages: `/import` = Upload, `/import/{sessionId}` = resolver, `/{id}/match`, `/{id}/review`. Publish is Review's terminal action (confirm dialog → commit → `/organization?asOf&reveal`). No `/publish`, `/ai`, `/issues`, success page. Committed → Organization; discarded → Upload. Shell owns only filename, effective date, journey, exit/discard.

**Why:** routes reflect user jobs, not backend phases (user's first-principles reanalysis).

**How to apply:**
- Stage = "can Fusion produce a complete canonical interpretation?" (unresolved required mappings/meanings). AI state (Pending/Failed/Available) must NOT decide the stage. AI is optional help inside Match.
- Match is ONE durable stage. Legacy mapping/interpreting/vocabulary are temporary internal substates only, and nothing outside Match may depend on them.
- "Automatically matched" is derived from mapping origins, never persisted.
- Backend was untouched for the routing pass only. A later BYOF logic pass (semantic field/shape mapping) may change it.

**Status (2026-09-23):** routing/surface pass IMPLEMENTED, uncommitted. `[sessionId]/layout.tsx` → `import-frame.tsx` (guard + shell + journey), `match-stage.tsx`, `review-stage.tsx`, `model/import-stage.ts` (+test). The monolith `import-review-workspace.tsx` is deleted, and the dead AI-apply inspector path was removed. Gates are green (tsc, lint, 61 import tests). Rendered QA was skipped at the user's request. Next is the Upload logic/states pass.

**Upload pass (2026-09-23), uncommitted.** Contract: `.local-docs/tmp3.md`.
- New `components/upload-stage.tsx` and `model/upload-source.ts`, each with tests. Choosing a file only selects it; an explicit "Start import" runs intake.
- Sheet choice is inline, never a stage. Processing is one calm state with no artificial hold.
- The UI branches on stable backend codes, mapped to Upload's categories.
- Resume shows the latest attempt only, per the user. Export is folded into the template card.
- Org no longer uses the shared `ImportOnramp`, which is Workforce-only now. Its org-only paths were purged (export, metaLine/href resume, processing, `organizationOnrampConfig`).
- The `[sessionId]` frame journey still uses the old small-dot style, not the new numbered stepper.
- Rendered on `qa-admin@fusion.test` / `Admin@123456` (Solara). Screenshots: `.local-docs/screenshots/org-import-upload/`.

**Match purge (2026-09-23), uncommitted.**
- Shared `components/import-header.tsx` (title, context, numbered stepper, actions) is used by Upload and the attempt frame. `import-frame.tsx` puts it in a PageContainer and provides the filename, a DatePicker labelled "Effective date", ⋯ Discard and Exit.
- `match-stage.tsx` is now an empty `<section aria-label="Match">` placeholder awaiting the new design.
- The Match tests were deleted. API hooks (confirmMapping/generateSuggestions/applySuggestions) and the stage rules stay.
