## 1. Transition preparation and contract inventory

- [x] 1.1 Inventory all runtime consumers of `OrgUnit`, `DraftOrgUnit`, TenantSetup publish/reopen, `Structure.*`, tenant settings types, `ResponsibleManagerEmployeeId`, and `WorkAssignment.OrgUnitId`; classify each as remove, replace, canonical consumer, or temporary Change 2 compatibility.
- [x] 1.2 Define canonical Organization request/response/error/concurrency contracts, including valid empty pre-root/pre-effective as-of results, stable scheduled-operation identifiers and individual cancellation, and a migration/reset runbook with explicit temporary adapter markers and the Change 2 removal owner.

## 2. Canonical Organization persistence and model

- [x] 2.1 Replace the mutable OrgUnit structural shape with immutable tenant-owned identity, calendar-date effective-state timeline, permanent future-capable root marker, stable scheduled-operation identity, and durable proposed/effective code-reservation model while preserving `OrgUnit.Id` as the workforce FK target.
- [x] 2.2 Add first-class global built-in and tenant custom Organizational Unit Types, state references, custom-name uniqueness across the resolved built-in/custom vocabulary, historical resolvability, and safe custom-type deletion behavior.
- [x] 2.3 Create the clean-slate EF migration/configuration: remove duplicate-name uniqueness, mutable parent/lifecycle/responsible-manager storage, and obsolete draft/publish persistence; add indexes/constraints/query filters needed for effective-state, code, type, and identity tenancy correctness.

## 3. Effective Organization domain operations

- [x] 3.1 Implement timeline resolution/normalization for calendar-date as-of state, valid empty pre-root/pre-effective results, same-date resulting-state merges, individually addressable scheduled operations, individual cancellation/recomputation, future-state rebasing, and meaningful state-diff/business-history derivation.
- [x] 3.2 Implement authoritative hierarchy resolution and validation for permanent future-capable root identity, zero-active-unit pre-effective results, post-root connectedness/acyclicity, same-tenant active parents, subtree implications, scheduled boundaries, and current readiness.
- [x] 3.3 Implement explicit root/unit creation, descriptive/type Change, dedicated subtree Move, terminal Inactivate, individual safe scheduled-operation cancellation, state Correction, and exceptional code Correction commands with required reasons and audit evidence.
- [x] 3.4 Add tenant-scoped structural write serialization plus aggregate ETag/expected-version handling that advances the exposed aggregate token after every successful unit mutation; translate stale writes, lock conflicts, and invariant failures into established API errors.

## 4. Canonical Organization API and query capability

- [x] 4.1 Replace current OrgUnit CRUD/tree reads with canonical as-of hierarchy (including valid empty pre-effective result), detail, duplicate-name-safe search, business-history, upcoming-change operation identifiers, readiness, and type-management query handlers/endpoints.
- [x] 4.2 Expose operation-specific mutation endpoints/DTOs for root/unit creation, Change, Move, Inactivate, individual scheduled-operation cancellation, state Correction, code Correction, and custom-type management; enforce explicit dates and versions.
- [x] 4.3 Update `Frontend/packages/api` and any non-visual shared contract consumers to use canonical Organization contracts; do not implement the Change 2 workspace.

## 5. Authorization and legitimate cross-domain contracts

- [x] 5.1 Add tenant-scoped `Organization.View` and `Organization.Manage` catalog entries, policy methods, and Tenant Administrator grants; remove canonical Organization fallback to roles, `Structure.*`, setup, and publish permissions.
- [x] 5.2 Reconcile the Work Assignment FK/index/query validation with the new stable OrgUnit identity and prove that structural changes never rewrite `WorkAssignment.OrgUnitId`.
- [x] 5.3 Remove `ResponsibleManagerEmployeeId`, its service, DTO/API exposure, audit paths, registrations, and obsolete capability/tests after the required consumer scan; do not introduce a replacement responsibility model.

## 6. Brownfield authority removal and bounded compatibility

- [x] 6.1 Remove/neutralize Draft Structure, draft import/session, TenantSetup publish/replace/reopen governance, and `Structure.Publish` so no path can create or replace canonical Organization truth.
- [x] 6.2 If required to keep pre-Change-2 source runnable, add only marked canonical read projections or canonical-operation forwarding adapters for legacy OrgUnit callers; block legacy draft/publish writes and add removal assertions naming Change 2.
- [x] 6.3 Update development bootstrap/reset documentation and fixtures for recreated canonical Organization data; do not migrate old development live/draft/setup data into invented effective history.

## 7. Domain, persistence, and integration verification

- [x] 7.1 Add domain tests for stable identity/tenant ownership, repeatable names, proposed/effective code uniqueness and reservation/correction, built-in/custom vocabulary uniqueness, permanent future root, effective intervals, Change versus Correction, terminal lifecycle, scheduled-operation identity, and business history.
- [x] 7.2 Add relational persistence/integration tests for state/timeline/operation constraints, type/code uniqueness, valid empty pre-root/pre-effective as-of resolution, post-root hierarchy validity at current/future/historical boundaries, tenant query-filter isolation, and database reset/migration behavior.
- [x] 7.3 Add operation tests for create, future root/unit creation, Change, past Change, same-date Rename/Move operation identity, individual scheduled-operation cancellation/recomputation, dedicated Move/subtree/cycle rejection, valid/blocked inactivation, state Correction, code Correction reservation rules, and concurrency-token/stale write outcomes.
- [x] 7.4 Add API/query tests for hierarchy/detail/search disambiguation/history/upcoming operation identifiers/readiness contracts, success and validation failures, `Organization.View` versus `Organization.Manage`, no-capability denial, platform-only denial, and cross-tenant non-disclosure.
- [x] 7.5 Update workforce contract tests to prove `WorkAssignment.OrgUnitId` retains a valid stable target across Organization structural changes; remove obsolete responsible-manager and draft/publish behavior tests.

## 8. Build and change verification

- [x] 8.1 Run focused CoreHR domain/feature/persistence/authorization/workforce tests and repair regressions.
- [x] 8.2 Run the CoreHR test project and backend solution/project build using the repository's documented commands; run relevant `Frontend/packages/api` type-check/lint if its contracts changed.
- [x] 8.3 Run the clean-slate development database migration/reset path and API integration suite against the resulting schema; confirm no legacy draft/publish mutation can alter canonical state.
- [x] 8.4 Run `openspec validate --changes establish-canonical-organization-foundation --strict`, inspect the final change status, and confirm only Change 1 OpenSpec artifacts plus implementation files in scope changed.
