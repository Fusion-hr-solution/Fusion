## Why

Performance has no objective-policy or governed template foundation: tenants cannot configure how
objectives are measured, weighted, approved, or cascaded, and the only template support is a flat,
single-revision `ObjectiveTemplate` with no measurement type, applicability, or lifecycle. Later P1
partitions (campaigns, employee planning) depend on a versioned, auditable policy + template
foundation that does not yet exist. This partition builds exactly that foundation — and nothing
downstream of it.

## What Changes

- Add a **platform configuration layer**: hard Performance guardrails, a versioned baseline objective
  policy (Draft → Published → Superseded), and an optional platform starter-template pack. Platform
  data is non-tenant-scoped and gated by `PlatformRole.PlatformAdmin`.
- Add a **tenant objective policy**: per-tenant versioned policy (Draft → Active → Superseded) with
  objective count, allowed weighting values, manager-validation SLA, cascade mode, measurement types,
  and attachments. Server-side validation including deterministic weight-feasibility (a valid 100%
  combination must exist) and active-template compatibility.
- Add **objective-template categories** (tenant-scoped, Active/Archived, code + name uniqueness).
- **BREAKING (internal):** **Replace** the flat `ObjectiveTemplate` aggregate with a
  **stable-identity + immutable-revision** model (template Draft/Active/Archived; revision
  Draft/Active/Superseded), Quantitative/Qualitative content, suggested weighting bound to the active
  policy, applicability criteria, tags, search/filter/pagination, and duplication. Existing rows are
  migrated; the old aggregate, `Level` enum, and flat table are removed after migration.
- Add **applicability** referencing Core workforce dimensions by stable identifier (org units +
  subtrees) and normalized value (job titles, locations, employment types); tenant-owned tags remain
  Performance-owned. Performance does not duplicate or own these workforce dimensions.
- Add **append-only configuration audit** spanning platform and tenant scope.
- Add **explicit, idempotent new-tenant provisioning**: on tenant creation, copy the Published
  baseline (+ selected starter templates) into a tenant-owned Active policy. No lazy/GET
  initialization; existing tenants are never silently mutated.
- Add **Platform Admin** (Performance defaults) and **Tenant Configuration** (Objective policy +
  Template library) UI in `apps/performance`, using the existing `@repo/ds` design system.

Non-goals (excluded, per spec §3.2): campaigns, campaign policy snapshots, workforce population,
participant activation, strategic/team objectives, employee objective plans, manager approval,
notifications, planning exceptions, progress, P1 planning lock, real OKR Key Results, AI generation,
template import/export, cross-tenant template sharing, nested categories, generic config engines,
and automatic bulk propagation of platform changes to existing tenants.

## Capabilities

### New Capabilities
- `performance-platform-defaults`: Platform Performance guardrails, versioned baseline policy
  lifecycle, starter-template pack, and guardrail impact analysis against active tenant policies.
- `performance-objective-policy`: Tenant objective-policy lifecycle, fields, server-side validation,
  weight feasibility, template compatibility, and policy history.
- `performance-objective-templates`: Template categories, stable template + revision lifecycle,
  Quantitative/Qualitative content, applicability, search/filter/pagination, and duplication.
- `performance-configuration-audit`: Append-only platform and tenant configuration audit with the
  required audit fields and the audit-view capability.
- `performance-tenant-provisioning`: Explicit, idempotent new-tenant baseline + starter-template
  provisioning and the existing-tenant non-mutation guarantee.

### Modified Capabilities
<!-- None. No existing OpenSpec capability changes its requirements. The flat ObjectiveTemplate
     replacement is internal implementation that has no prior OpenSpec spec. CoreHR and Identity
     additions below are referenced contracts owned by those modules, not requirement changes to
     existing Performance specs. -->

## Impact

- **Backend `EY.HRPlatform.Performance`**: new `Domain/Entities` (Platform/*, TenantObjectivePolicy,
  ObjectiveTemplateCategory, ObjectiveTemplate + ObjectiveTemplateRevision,
  PerformanceConfigurationAuditEntry); new `Features` slices; new EF configurations + migrations;
  replacement of the flat `ObjectiveTemplate`; data migration.
- **SharedKernel `CorePermissionCatalog`**: new `PerformancePermissions` entries + catalog
  definitions (tenant policy / category / configuration-audit); reuse `ObjectiveLibrary{View,Manage}`
  for template view/manage; platform defaults gated by `PlatformRole.PlatformAdmin`.
- **CoreHR (referenced contract, Core-owned)**: small tenant-scoped applicability-options read added
  to `internal/corehr/*` and `ICoreWorkforceClient` (org-unit ids + distinct
  job-title/location/employment-type values). CoreHR remains the owner.
- **Identity (referenced contract, Identity-owned)**: `TenantService.CreateAsync` calls a new typed
  `IPerformanceProvisioningClient` after tenant commit. Identity keeps tenant ownership.
- **Frontend `apps/performance`**: greenfield Configuration pages + `PlatformRole`-gated
  `(platform-admin)` route group; reshaped `@repo/api` performance client.
- **Tenancy/ownership**: introduces platform-scoped (non-tenant) data; preserves Core as workforce
  source of truth and Identity as permission authority.
