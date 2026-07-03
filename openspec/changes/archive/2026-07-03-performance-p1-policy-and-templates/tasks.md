## 1. Authority and continuity

- [x] 1.1 Keep `.local-docs/Performance/P1/P1.1/performance-p1.1-policy-and-objective-templates-specification.md` as the authoritative product source for this change.
- [x] 1.2 Rebaseline the active change artifacts and main OpenSpec capability specs around that local P1.1 specification without archiving the change.
- [x] 1.3 Keep checked items reserved for slices where the local authority spec, OpenSpec, and implementation still align well enough to stay closed.

## 2. Slice A — Platform Defaults and provisioning

- [x] 2.1 Keep Platform Defaults locked to the no-Draft, edit-and-apply model with truthful reads, fail-closed impact handling, and no platform starter-template ownership.
- [x] 2.2 Keep policy-only tenant provisioning locked: copy the current platform standard setup, never mutate existing tenants, and never initialize on read.
- [x] 2.3 Keep Platform Admin out of tenant template ownership and keep platform starter-template runtime ownership removed from the target model.

## 3. Slice B — Tenant Objective Policy

- [x] 3.1 Backend: compare the current tenant-policy aggregate, lifecycle, and service behavior against the authority-spec flow of Current policy -> Edit locally -> Review -> Apply.
- [x] 3.2 Backend: remove or demote any surfaced/resumable tenant-policy Draft workflow from product behavior while preserving one Active version, immutable superseded versions, and optimistic concurrency.
- [x] 3.3 Backend: enforce the authority-spec validation set for Apply, including objective-count limits, allowed weights, max weight-choice count, measurement-method requirements, manager-review SLA, exact-100% feasibility, active-template compatibility, idempotency, and stale-update rejection.
- [x] 3.4 API/contracts: realign policy DTOs, endpoints, statuses, and error mappings so product language centers on current policy, local edits, validation/impact review, Apply, not-provisioned, retryable failure, and stale update.
- [x] 3.5 Frontend: rebuild the tenant policy surface around the authority-spec states and UX: current policy, local unsaved edits, review before Apply, not-provisioned, validation failure, conflict, retryable failure, denied, and success.
- [x] 3.6 Frontend: preserve entered values on retryable failure, keep edits local until Apply, and ensure reads never create policy state.
- [x] 3.7 History: reduce policy history to the simple read-only version list required by P1.1 (current marker, applied date, actor, concise summary) and remove any broader history/diff workflow from the product surface.
- [x] 3.8 Tests: add or update backend and frontend regression coverage for AC-P1.1-08 through AC-P1.1-14, including impossible weights, policy/template conflict, stale Apply rejection, not-provisioned reads, and failure-preserves-work.
- [x] 3.9 Checkpoint: verify the full tenant-policy flow against the authority spec end to end and close this slice only when product, UI/UX, backend, API, and tests all agree.

## 4. Slice C — Audit and history boundary cleanup

- [x] 4.1 Backend: compare current audit/history implementation against sections 15 and 21 of the authority spec and identify any generic-audit behavior that exceeds P1.1.
- [x] 4.2 Backend: keep append-only lifecycle records for platform applied states, tenant policy versions, template revisions, category lifecycle, and blocked/failed state transitions where the authority spec requires traceability.
- [x] 4.3 Backend: remove or defer any platform-wide or tenant-wide generic audit browser behavior that contradicts the explicit P1.1 deferral.
- [x] 4.4 API/contracts: expose only the minimal user-facing history surfaces required now: simple tenant policy history, simple template revision history, and concise Platform Defaults current/last-updated facts.
- [x] 4.5 Authorization: verify platform history facts require `PlatformRole.PlatformAdmin` with no tenant context, and tenant history requires authoritative tenant context plus the relevant tenant capability.
- [x] 4.6 Frontend: trim history surfaces to the minimal P1.1 contract and remove any UI that implies a broad audit product or cross-product audit browser.
- [x] 4.7 Tests: add or update regression coverage for append-only lifecycle records, denied history access, fail-closed scope separation, and the absence of reads that mutate state.
- [x] 4.8 Checkpoint: verify that history/audit behavior now matches the authority spec's required-now versus deferred boundary before moving on.

## 5. Slice D — Template Library and Categories

- [x] 5.1 Backend: compare category and library behavior against sections 11 and 12 of the authority spec and confirm categories remain flat, lightweight, tenant-owned, and safe to archive/reactivate.
- [x] 5.2 Backend: keep or realign category uniqueness, archive rules, referenced-category delete constraints, and Active-template retention behavior to the authority spec.
- [x] 5.3 Backend: tighten library discovery to the MVP contract only: keyword search, category filter, status filter, measurement-method filter, server-side pagination, and one predictable default sort prioritizing Active templates.
- [x] 5.4 API/contracts: ensure library endpoints and DTOs expose only the required discovery/filter/sort behavior for P1.1 and do not elevate optional or deferred discovery features into completion requirements.
- [x] 5.5 Frontend: realign library states to the authority spec, including empty library, no-results, read-only access, permission denied, predictable default Active prioritization, and lightweight category management in library context.
- [x] 5.6 Frontend: confirm duplication, archive, restore, and constrained delete behavior is presented in product language and does not drift into generic CRUD.
- [x] 5.7 Tests: add or update coverage for AC-P1.1-15 through AC-P1.1-18 plus empty/no-results/read-only states and safe category archive behavior.
- [x] 5.8 Checkpoint: verify categories and the basic template library are usable and match the authority-spec MVP before treating this slice as aligned.

## 6. Slice E — Template Authoring and Lifecycle

- [x] 6.1 Backend: compare template authoring and lifecycle behavior against section 13 of the authority spec, including Draft/Active/Archived template states and immutable Active revisions.
- [x] 6.2 Backend: keep Quantitative and Qualitative authoring rules aligned, including required content, suggested weighting constraints, measurement-method switching rules, duplication, archive/restore, and constrained hard deletion.
- [x] 6.3 Backend: ensure editing an Active template creates unpublished changes rather than mutating the Active revision in place, and activation supersedes rather than deletes the prior Active revision.
- [x] 6.4 API/contracts: align authoring DTOs, validation errors, lifecycle operations, and status language with the authority spec's product terms such as Active template, unpublished changes, expected outcome, and success criteria.
- [x] 6.5 Frontend: realign the editor flow around Basics / Measurement / Classification / Applicability / Review behavior that preserves work, warns before destructive measurement-type changes, and treats incomplete Drafts as saveable but not activatable.
- [x] 6.6 Frontend: ensure authoring, duplication, archive, restore, and constrained deletion are explained through the product workflow rather than raw persistence terminology.
- [x] 6.7 Tests: add or update coverage for AC-P1.1-19 through AC-P1.1-23 plus measurement-switch warnings, incomplete Draft saveability, retryable failure preservation, and immutable Active revision behavior.
- [x] 6.8 Checkpoint: verify Quantitative and Qualitative templates can be authored and activated safely end to end under the current tenant policy.

## 7. Slice F — Applicability, migration, and final hardening

- [x] 7.1 Backend: compare applicability behavior against section 14 of the authority spec and keep the required MVP as tenant-wide or selected Core organizational units with explicit descendant inclusion.
- [x] 7.2 Backend: ensure organizational-unit references use stable Core identifiers, preserve stored descendant decisions, and reject unresolved or cross-tenant references without disclosure.
- [x] 7.3 Backend: treat job title, work location, and employment type applicability only as optional extensions if they already remain cleanly implemented and preserve the authority-spec semantics.
- [x] 7.4 Migration: verify legacy-template migration, ambiguous-data handling, existing-tenant policy repair, and platform starter-template cleanup against section 16 of the authority spec.
- [x] 7.5 Verification environment: run migration, uniqueness, tenant-filter, optimistic-concurrency, and real-database verification against the supported engine with no pending model drift.
- [x] 7.6 Frontend: realign applicability UX to the MVP contract, keeping tenant-wide and selected organizational-unit behavior primary and ensuring optional dimensions do not become completion blockers.
- [x] 7.7 Tests: add or update coverage for AC-P1.1-24 through AC-P1.1-30 plus migration-without-silent-loss, cross-tenant rejection, unauthorized operations, retryable failure preservation, and end-to-end tenant foundation readiness.
- [x] 7.8 Checkpoint: verify tenant-wide and org-unit applicability, migration, concurrency, authorization, and tenant isolation all match the authority spec before final completion work.

## 8. Final verification and completion

- [x] 8.1 Re-run strict OpenSpec validation after each material slice update and keep both the active change and main specs valid.
- [x] 8.2 Run backend build and tests covering the realigned P1.1 slices and confirm green results against the updated contracts.
- [x] 8.3 Run frontend test, type-check, and lint verification for the Performance app and confirm green results against the updated UX states.
- [x] 8.4 Perform real UI checkpoints for the authority-spec acceptance flows, not just compile/test verification.
- [x] 8.5 Record every remaining mismatch between the local spec, OpenSpec, and implementation as explicit rework, a defect, or an approved deferral.
- [x] 8.6 Mark P1.1 complete only when sections 19 and 22 of the authority spec are satisfied and the local spec, OpenSpec, implementation, tests, and acceptance evidence all agree.

## Recorded deferrals and notes (8.5)

- Authority-spec §21 deferrals stand unchanged (generic audit browser, rich diff UI, tag governance, approval workflow, content packs, bulk library operations, provisioning dashboard, and the rest of the §21 list). None were introduced.
- Existing-tenant policy repair (§16.3) is satisfied through the explicit, observable, retryable provisioning path (not-provisioned state plus internal provisioning endpoint) rather than a one-time repair migration; runtime reads stay side-effect free. Approved deferral of a bulk repair migration until a tenant with pre-P1.1 performance data actually exists.
- Optional applicability dimensions (job title, work location, employment type) remain as verified extensions per §14.5; they resolve against Core options and are not completion criteria.
- The simple template revision history (§15.2) is exposed in the editor Review tab and via `GET /template-library/{id}/history`; any richer tenant-wide change-history surface stays deferred to the unified Performance+Core audit integration.
