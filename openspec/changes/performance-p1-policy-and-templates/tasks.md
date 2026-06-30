## 1. Foundation (capabilities, scopes, persistence scaffold)

- [x] 1.1 Add `PerformancePermissions` entries (tenant policy view/manage, template-category manage, configuration-audit view) and `CorePermissionCatalog` definitions; reuse `ObjectiveLibrary{View,Manage}` for template view/manage. Build SharedKernel.
- [x] 1.2 Extend `PerformanceAccessPolicyService` with policy/category/audit/platform-defaults checks (platform gated by `PlatformRole.PlatformAdmin`), deny-by-default; unit-test each check.
- [x] 1.3 Add `PerformanceConfigurationAuditEntry` entity (platform-or-tenant scope, required audit fields, append-only) + EF configuration; reuse the `PerformanceCycleAuditEvent` field shape.
- [x] 1.4 Add a reusable configuration-audit writer service used by all later slices.

## 2. Slice 1 — Platform guardrails + baseline (`performance-platform-defaults`)

- [x] 2.1 Add non-tenant-scoped `PlatformPerformanceGuardrails`, `PlatformObjectiveBaseline(Version)` entities (no query filter, not `ITenantEntity`) + EF configs + migration.
- [x] 2.2 Implement guardrail read/edit-draft/publish and baseline read/edit-draft/publish handlers with immutability of published versions and audit.
- [x] 2.3 Implement guardrail impact analysis across active tenant policies; block conflicting publication with affected-tenant count + reasons; expose deterministic error codes.
- [x] 2.4 Add `ObjectiveDefaultsController` (platform endpoints) gated by `PlatformRole.PlatformAdmin`; verify tenant endpoints cannot reach platform data.
- [x] 2.5 Frontend: `(platform-admin)` route group in `apps/performance` (PlatformRole-gated) — Performance defaults landing + guardrail editor + baseline editor (labelled "Default for newly provisioned tenants"), built on `@repo/ds/shell`.
- [x] 2.6 **Checkpoint (UI):** Platform Admin publishes a valid baseline; a conflicting guardrail publication is blocked showing affected-tenant count (AC-PT1-03).

## 3. Slice 2 — Tenant objective policy (`performance-objective-policy`)

- [x] 3.1 Add `TenantObjectivePolicy` (unique per tenant) + `TenantObjectivePolicyVersion` (Draft/Active/Superseded), tenant-scoped, xmin row-version + EF configs + migration.
- [x] 3.2 Implement create-draft-from-active, update, validate, publish (supersede prior), discard, history handlers with audit + idempotent publication.
- [x] 3.3 Implement server-side policy validation (count/weight/SLA/measurement rules) and deterministic weight feasibility (subset-sum to 100% within max objectives).
- [x] 3.4 Implement active-template compatibility check feeding publication impact (lists affected templates + conflicting field).
- [x] 3.5 Add `ObjectivePolicyController` (tenant) with `If-Match`/`ETag` concurrency; map errors to deterministic codes/HTTP statuses.
- [x] 3.6 Frontend: policy read view → edit form → chip/numeric weight editor with live 100% feasibility → impact review → history, with unsaved-changes protection and error summary.
- [x] 3.7 **Checkpoint (UI):** Tenant Admin edits and publishes a policy; impossible weight policy blocked (AC-PT1-05); unauthorized publish denied (AC-PT1-07); discard preserves Active (AC-PT1-08).

## 4. Slice 3 — Template categories (`performance-objective-templates`)

- [x] 4.1 Add `ObjectiveTemplateCategory` entity (tenant-scoped, code + normalized-name uniqueness, Active/Archived) + EF config + migration.
- [x] 4.2 Implement create/rename/archive/reactivate handlers with in-use protection, duplicate-code rejection, and audit.
- [x] 4.3 Frontend: lightweight category management surfaced from the Template Library context.
- [x] 4.4 **Checkpoint (UI):** create a category (AC-PT1-10); archive a used category safely so existing templates retain it (AC-PT1-11).

## 5. Slice 4 — Template model, revisions, content, activation (`performance-objective-templates`)

- [x] 5.1 Add `ObjectiveTemplate` (stable identity, Draft/Active/Archived) + `ObjectiveTemplateRevision` (Draft/Active/Superseded) entities + EF configs + migration; replace the flat aggregate.
- [x] 5.2 Implement create-draft, update-draft, validate, activate (supersede prior, immutable Active), edit-active-via-new-revision handlers with audit.
- [x] 5.3 Implement Quantitative/Qualitative content validation and suggested-weighting binding to the Active policy; block activation without an Active policy.
- [x] 5.4 Rework `ObjectiveTemplatesController` + `performance.ts` API client for the new template/revision DTOs (keep xmin/`ETag`).
- [x] 5.5 Frontend: template editor (Basics / Measurement / Classification / Applicability / Review) with measurement-type switching warnings; Save Draft vs Activate with distinct emphasis.
- [x] 5.6 **Checkpoint (UI):** create+activate Quantitative (AC-PT1-12), block incomplete Quantitative (AC-PT1-13), Qualitative activate (AC-PT1-14), edit-Active-via-revision (AC-PT1-15), activate revision (AC-PT1-16), policy↔template conflict block (AC-PT1-09).

## 6. Slice 5 — Library, applicability, duplication, archive (`performance-objective-templates`)

- [x] 6.1 Add the Core applicability-options read to `internal/corehr/*` (CoreHR) returning org-unit ids + distinct job-title/location/employment-type values; surface on `ICoreWorkforceClient`; CoreHR-side tests.
- [x] 6.2 Implement applicability persistence (org units by stable Core `Guid`; string dimensions by normalized value; tenant-owned tags); allow a Draft to hold an unresolved reference with a blocking validation state; block activation on unresolved or cross-tenant/unknown org-unit refs without disclosure.
- [x] 6.3 Implement server-side search/filter/sort/pagination (title/code/description/tags) and template duplication (new identity + Draft, source reference, no history copy).
- [x] 6.4 Frontend: library list with compact filters + progressive disclosure, applicability picker resolving labels in batches, row + overflow actions, empty/no-results/permission states.
- [x] 6.5 **Checkpoint (UI):** duplicate (AC-PT1-18), archive (AC-PT1-17), full-breadth applicability selectable, cross-tenant applicability rejected (AC-PT1-19), keyboard-complete flow (AC-PT1-22).

## 7. Slice 6 — Provisioning, migration, cleanup (`performance-tenant-provisioning`)

- [x] 7.1 Add signed `internal/performance/tenants/{tenantId}/provision` endpoint + handler copying Published baseline (+ selected starter templates) into a tenant-owned Active policy; idempotent (exists → no-op returning existing).
- [x] 7.2 Add `IPerformanceProvisioningClient` in Identity and call it explicitly from `TenantService.CreateAsync` after tenant commit; no lazy/GET initialization.
- [x] 7.3 Implement the platform starter-template pack (Slice 1 entities) management + copy-on-provision; ensure existing tenants are never silently mutated on baseline publish (AC-PT1-02).
- [x] 7.4 One-time data migration of existing `ObjectiveTemplates` rows → new model (one Active revision, Qualitative default, `Category` → category, drop `Level`); reject ambiguous data with diagnostics.
- [x] 7.5 Remove the old flat `ObjectiveTemplate` aggregate, EF config, `Level` enum, dead `/goals`+`/analytics` nav, and temporary migration code; correct the performance sidebar.
- [x] 7.6 **Checkpoint (UI):** provision a tenant from baseline (AC-PT1-01); re-running provisioning is a safe no-op; migrated templates appear as Active revisions; no second runtime model remains.

## 8. Cross-cutting and verification

- [x] 8.1 Ensure deterministic error codes (spec §21), form-preservation on retryable failure (AC-PT1-20), stale-update rejection (AC-PT1-21), and idempotent publication across all mutating endpoints.
- [x] 8.2 Implement loading skeletons, empty/error/permission states, success feedback, and WCAG 2.2 AA + i18n/RTL readiness across all pages.
- [x] 8.3 Backend tests: policy validation, weight feasibility (`{30,40}`/max-2), revision lifecycle, category lifecycle, concurrency, idempotency, audit, tenant isolation, platform/tenant scope separation, authorization, Core applicability validation, provisioning idempotency + existing-tenant non-mutation.
- [x] 8.4 Frontend tests: workflow, states, weight-editor feasibility, impact-review gating, keyboard navigation, screen-reader semantics (pattern: `apps/core` hook tests).
- [x] 8.5 Run backend build + `dotnet test`, and `pnpm --filter performance test`, `pnpm lint`, `pnpm type-check`; ensure green.
- [x] 8.6 Demonstrate the full §40.4 end-to-end UI flow (12 steps) including unauthorized + cross-tenant rejection.
