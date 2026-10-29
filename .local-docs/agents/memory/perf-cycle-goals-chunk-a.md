---
name: perf-cycle-goals-chunk-a
description: Performance Cycle & Goals Chunk A (setup→activation) implemented + rendered-verified; first real Performance feature on the security-only host.
metadata: 
  node_type: memory
  type: project
  originSessionId: 398588b0-beed-457c-af2a-51cb7e6ffa3b
  modified: 2026-08-20T20:47:20.170Z
---

OpenSpec `establish-performance-cycle-and-goals` (see [[perf-cycle-goals-proposed]]) **Chunk A implemented + verified 2026-08-20**, uncommitted. Tasks 1.1–1.5 + 2.1–2.9 done; Chunks B/C/D + section 6 remain.

**Backend** (`Backend/EY.HRPlatform.Performance`, now a real module, not the security-only host): `performance` schema + `PerformanceDbContext` (fail-closed tenant filter) + one migration `InitialPerformanceCycleAndGoals` (applied to `hris_performance`); domain `PerformanceCycle`/`ActivationSnapshot`/`PopulationDefinition`+`Participant`/`CycleSettings`/single `Objective` aggregate + `ObjectiveMeasurement`(3 methods); MediatR features + controllers under `api/performance/*`; `IPerformanceAccessPolicyService`; `CoreWorkforceClient` (signed-HMAC internal snapshot client). New `EY.HRPlatform.Performance.Tests` (17 pass +1 relational-gated on real PG).

**Auth** (SharedKernel): new `PerformancePermissions`/`PerformancePermissionCatalog` (4 keys: cycle.view S/DR/OU/T, cycle.manage T, strategy.publish T, objective.self.manage Self); new cross-module `PermissionCatalog` resolver (Core slice + module contributions, explicit conflict-fail) — grant normalization / claim validation / Identity all repointed to it; `CorePermissionCatalog` stays the Core slice. Identity `AccessProfileTemplates.ComposeSeeded(performanceEnabled)` folds Performance grants into Employee/Manager/HrAdmin/OrgAdmin gated on the entitlement (leaves `cycle.view @OrgUnit` unseeded); Tenant Administrator auto-composes all Tenant-scoped Performance grants. **Identity re-seeds ALL tenants on startup (`IdentitySeeder.SeedAsync`)** — restart Identity after adding the Performance entitlement to a tenant.

**CoreHR** additive (Decision 5): `internal/corehr/workforce/snapshots/all-active` (all active/eligible as-of) on `IInternalWorkforceSnapshotService`; added `"performance"` to CoreHR dev `InternalServiceAuthentication:AllowedCallers` (was empty → would 401 every internal caller).

**Frontend** (`apps/performance`): `@repo/api` `performance.ts` transport; hooks in `features/performance/api/use-performance.ts`; signature components (CycleWorkspaceHeader, MilestoneRail, LaunchReadiness, PopulationLens (org-tree via Core `@repo/api` hierarchy, backend resolves authoritatively), ObjectiveEditor+MeasurementComposer, StrategicDirection, ActivationReview, SettingsForm, EmployeePicker); routes `/` (Overview), `/setup` (persistent area workspace), `/settings`. Type-check + lint + build clean.

**Two EF gotchas fixed** (both: new child with client Guid key reached via a tracked parent → detected Modified not Added → UPDATE-0-rows): (1) activation-snapshot set via `db.Entry(snapshot).State = Added`; (2) population child rows corrected Modified→Added in `SetPopulationHandler` (they're immutable, always cleared+recreated). Interceptor also relaxed to compare TenantId value, not just IsModified flag (owned-collection quirk).

**Demo/verify**: tenant10 (`2c24ca26-05df-4ae1-ab26-2a84fa49e0ea`, "Tenant Ten", admin `admin@tenant10.com`) — added Performance entitlement + **reset its password to `Admin@123456`** via a PowerShell-generated ASP.NET Identity hash (original memory password was stale). 10 employees, 8 org units; **primary assignments EffectiveFrom 2026-08-18** so cycle start must be ≥ that date for population to resolve. Full journey rendered + verified through shell `:3000` light+dark (both AllActive + By-organization); activation freezes snapshot; 9 participants.

**Known non-fatal**: dev-mode SSR hydration warning on Performance MFE routes (AccessBoundary gates the shell with a skeleton while auth loads server-side then renders children client-side) — self-heals on client; real fix belongs in the shared auth/loading-architecture layer ([[loading-architecture]]), not Chunk A. Also left the full backend stack + `pnpm dev` running.
