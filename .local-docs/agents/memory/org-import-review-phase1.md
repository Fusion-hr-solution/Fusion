---
name: org-import-review-phase1
description: Org Import Review Phase 1 (2026-09-24) — contracts/substrate reconciled to the user's Review contract; Phase 2 (Review UI/UX redesign) pending; uncommitted
metadata:
  type: project
---

Review stage of Organization Import reworked in two phases per the user's "Surface 3: Review" contract. **Phase 1 (contracts + substrate) done 2026-09-24; Phase 2 surface built same day from the user's design reference (status banner, read-only searchable tree w/ one icon per type, Review checks card hosting every fix, Structure + Import context cards, sticky footer Back to Match / Publish). Unit click = select only (no inspector, user choice). Review now scrolls as a document like Match. Uncommitted.** Report: `.local-docs/core/org-import-review-phase1-reconciliation.md`.

Binding user decisions:
- Review is read-only: NO rename/recode/retype/re-parent/exclude (exclusion explicitly rejected — makes source/Mapping Plan dishonest). Semantic fixes → back to Match; data fixes → corrected file.
- Only bounded resolutions: add organization root (only when MultipleRoots), keep existing (stable identity difference), use existing X (explicit pick from server-listed same-name candidates; never auto-merge by name).
- Issues carry `preferredResolution` + `allowedResolutions[]` decided by the server per instance (e.g. MissingParent typo→CorrectSource vs misread column→ReturnToMatch). ChangeEffectiveDate only for as-of-date codes. Review projection has canonical-result issues only (no Match-stage codes). No InvalidRootType (domain doesn't enforce root type).

Shape: single chain interpreter → `OrganizationImportDraftBuilder` → `OrganizationImportValidator` (sole graph rules) → `OrganizationImportReviewProjection` (`session.review`, null until Match complete; flat nodes+depth+anchors, readiness, summary, fingerprint). `OrganizationImportIssueCatalog` = severity authority. `PUT {id}/review/resolutions`; commit body `{proposalFingerprint}`; Match plan change clears resolutions (entity invariant). Phase-1 frontend is a minimal adapter over the old workspace (no redesign). Related: [[org-import-stage-architecture]], [[org-import-semantic-assistance]].
