## Context

Core HR currently persists `OrgUnit` as one mutable row (`Name`, string `Type`, `ParentId`, `IsActive`, `ResponsibleManagerEmployeeId`) and permits multiple roots. A parallel `DraftOrgUnit` / Tenant Setup workflow imports and edits a draft, then `PublishTenantStructure` matches by code and replaces/deactivates the live structure. The current API is a now-only CRUD tree; the existing `Structure.*` capabilities include a publish permission and OrgUnit mutations also carry an `HRAdmin` role attribute.

That model contradicts the locked Feature 4 contract. Core HR must instead own one date-effective, tenant-scoped Organization truth while retaining the stable `OrgUnit.Id` referenced by `WorkAssignment.OrgUnitId`. The existing workforce date convention is useful evidence, but Organization is calendar-date business state, not a timestamped workforce fact.

Change 2 owns the visual workspace. This change exposes complete backend contracts for it without creating `/core/organization`, Chart/Outline UI, routing, or navigation changes.

## Goals / Non-Goals

**Goals:**

- Establish one canonical, effective-dated Organization model with stable identity, immutable tenant ownership, durable code reservation, repeatable names, permanent root, valid as-of tree, and type vocabulary.
- Expose coherent tenant-scoped commands and queries for all locked Organization operations and Change 2's Chart, Outline, search, inspector, history, upcoming-change, and readiness needs.
- Enforce capability-based, deny-by-default tenant authorization and robust hierarchy concurrency/integrity.
- Remove or contain every draft/publish path that could create competing Organization truth, while preserving the valid workforce identity reference.

**Non-Goals:**

- UI routes, workspace rendering, drag/drop interaction, Getting Started, post-login routing, navigation, import, reporting, People, Work Assignment redesign, or scoped workforce authorization.
- A generic Organization configuration engine, hierarchy type grammar, reorganization-event framework, or successor responsibility model.
- Preservation/migration of development database contents, draft structure data, setup-cycle data, or old published structures.

## Decisions

### 1. Stable `OrgUnit` identity with versioned Organization state

Retain `OrgUnit` as the stable Core HR aggregate/table identity consumed by `WorkAssignment.OrgUnitId`, with immutable `Id` and `TenantId`, an `IsRoot` marker, current business code, PostgreSQL `xmin`, and no mutable structural fields. Replace the current `Name`, string `Type`, `ParentId`, `IsActive`, and `ResponsibleManagerEmployeeId` storage with an `OrgUnitEffectiveState` timeline.

Each state is a complete snapshot of `Name`, type reference, parent reference, and lifecycle (`Active` or `Inactive`) over a half-open calendar-date interval `[EffectiveFrom, EffectiveTo)`. The implementation uses `DateOnly` for all Organization effective dates; no time-zone conversion or intraday sequence is permitted. A unit has exactly one state at any date or no effective state before creation/after cancellation. `EffectiveTo` is derived/maintained from the next state start and database constraints/indexes enforce one start per unit/date and valid intervals.

State records retain changed-attribute metadata. Each business operation, including a future operation, also has a stable operation identity independent of the normalized state snapshot. Commands normalize compatible same-date operations into one resulting snapshot, then rebase later snapshots only for attributes they do not themselves change. This keeps scheduled changes intact while preventing an unrelated current change from spuriously reverting at a later scheduled date. It also lets a same-date rename and Move remain independently visible in Upcoming Changes and independently cancellable without treating persistence versions as history.

Alternative: mutate a single live row plus audit events. Rejected because current/future/historical as-of truth and Change versus Correction become reconstructed guesses. Alternative: event-source every field mutation. Rejected because it is a new persistence architecture with more operational complexity than Feature 4 needs.

### 2. Code reservation is separate from effective state

Persist normalized business code on the stable identity and enforce tenant uniqueness for every proposed or effective unit. Introduce `OrgUnitCodeReservation(TenantId, NormalizedCode, OrgUnitId)`, unique by tenant and code. Reserving a code on the first effective state is permanent even if the unit is later retired or a code correction changes the aggregate's current code. A never-effective planned unit can revise or release its proposed code because no reservation exists yet.

Ordinary Change commands never accept a code. Subject to the general proposed/effective code-uniqueness rule, a dedicated, reason-required Correction updates the aggregate's current code only when the target code is unreserved or is already permanently reserved to that same Organizational Unit identity; any reservation belonging to another identity rejects the correction. The corrected code is permanently reserved and every prior effective code remains reserved to the same identity. The correction is audit history, not an effective business-state transition.

Alternative: rely on a unique `OrgUnits(TenantId, Code)` index. Rejected because it loses reservation history after correction/retirement and cannot establish that an old code belongs only to the same stable identity.

### 3. Types are first-class, globally built-in or tenant-custom classifications

Persist `OrganizationalUnitType` with immutable identity, display name and normalized name, and either a global built-in marker or tenant owner. Seed deterministic global built-ins: Organization, Business Unit, Division, Department, Team, and Unit. Queries intentionally admit globally built-in rows plus current-tenant custom rows; custom-type access is always tenant-filtered and built-ins are not mutable through tenant APIs.

Effective states reference this type identity. Root creation requires the built-in Organization type; root type never changes. A custom type name is unique across the tenant's resolved vocabulary, including every built-in name, so a tenant cannot create or rename a custom `Department`. A custom type can be renamed (a vocabulary label change visible wherever it resolves), deleted only when no historical or scheduled state references it, and otherwise remains resolvable. Types carry no hierarchy, workflow, field, assignment, or security rules.

Alternative: retain `TenantSettings.OrgUnitTypes` string lists. Rejected because they do not preserve historical resolution or distinguish immutable built-ins from custom vocabulary.

### 4. Root and hierarchy validity are evaluated from resolved snapshots

The first root command creates the tenant's one permanent root identity with `IsRoot=true`, no parent, built-in Organization type, and an active state at its supplied date. A tenant-level unique root constraint/guard makes a second root impossible even if the first is scheduled in the future. Before any root identity exists, the tenant may have zero Organizational Units. Once a root identity exists but its first state is future-effective, an as-of date before that first state validly resolves to zero active units and zero active roots; readiness is not Ready. From the root's first effective date onward, exactly one active root is required. Root rename and other descriptive changes are allowed; Move, parent assignment, type change, cancellation, and inactivation are rejected. Once effective, the root therefore cannot disappear from the active hierarchy.

`OrganizationHierarchyResolver` loads the tenant's effective identities/states at a supplied `DateOnly` and returns either the valid empty pre-root/pre-effective result or the active graph. Once the root is effective, it validates exactly one active root, one active parent for every non-root, same-tenant parent/type references, reachability, and acyclicity. It returns canonical nodes, parent links, ancestry paths, and structural metadata required by both Chart and Outline. The validator runs for the requested effective date and every affected state-boundary date through the changed timeline; because state is piecewise constant, validation at those boundaries proves every represented interval.

All canonical commands run in one transaction after acquiring a tenant-scoped PostgreSQL transaction advisory lock, then validate the resulting boundaries before commit. The lock serializes structural writers for a tenant; aggregate `xmin`/If-Match is also required where a caller modifies, corrects, cancels, moves, or inactivates an existing unit. Every successful mutation affecting an Organizational Unit, including Change, Move, Inactivate, individual scheduled-operation cancellation, and either Correction, MUST advance the aggregate concurrency token returned to clients, even when the primary persistence mutation is an effective-state or operation-row insert/update. A stale ETag, serialization failure, or state conflict returns the established concurrency conflict response, never a best-effort merge.

Alternative: only validate the edited node's parent chain. Rejected because separate concurrent/scheduled changes can invalidate an otherwise locally valid future tree. Alternative: rely on a self-FK/database tree constraint. Rejected because relational constraints cannot prove time-dependent connectedness or cycles.

### 5. Commands model business operations, not generic CRUD

The canonical command surface is explicitly operation-oriented:

| Operation | Result |
|---|---|
| Create root / Create unit | creates stable identity plus active effective state; unit creation needs an active parent at that date |
| Change details/type | creates/merges the supplied-date business state; cannot change parent or effective code |
| Move | changes only parent at supplied date and moves the resolved subtree by retaining descendant identities/links |
| Inactivate | creates terminal inactive state; root and units with active descendants at any affected boundary are rejected |
| Cancel scheduled operation | safely removes one never-effective future operation by its stable operation identity only if recomputation/revalidation leaves the timeline/tree valid |
| Correct state | repairs a selected recorded state with a reason and audit record; it does not invent a business-change event |
| Correct business code | exceptional reason-required audited correction with permanent reservation behavior |

Future operations never change today's result. Past-dated Changes and Corrections are allowed only through explicit command modes and receive full boundary validation; the normal UI path remains Change-at-today/future. Once a unit is inactive, no state may reactivate the same identity. Cancellation targets one stable scheduled-operation identity, recomputes the same-date resulting state and later timeline, and is rejected if it would leave invalid dependent future truth; it never silently cancels unrelated same-date operations or automatically cascades deletion.

Business history is generated from meaningful effective-state diffs (`Created`, `Renamed`, `Type changed`, `Moved`, `Inactivated`) and includes future changes with scheduled status. Audit history records actor, time, command, reason where required, and correction details separately. This change uses existing Fusion audit infrastructure rather than exposing raw event data as Organization history.

Alternative: retain `PUT` with parent mutation and `DELETE` soft-delete. Rejected because it obscures Move, cannot represent date semantics, and retains the prohibited reactivation model.

### 6. Canonical API/query contracts are date-aware and UI-neutral

Replace the Organization API with a tenant-scoped `api/corehr/organization` capability (exact DTO names/routes are implementation-owned) that provides:

- `GET hierarchy?asOf=` returning one resolved tree plus node id/name/code/type/lifecycle/parent/path/children metadata for Chart and Outline;
- `GET units/{id}?asOf=`, `GET search?query=&asOf=`, and `GET units/{id}/history` with duplicate-name-safe path/code context;
- `GET upcoming-changes` (including each stable scheduled-operation identifier), `GET readiness`, and type-list/manage contracts;
- explicit command endpoints for root/unit creation, Change, Move, Inactivate, cancellation by stable scheduled-operation identifier, Correction, code correction, and type management, with ETags/expected versions where applicable.

All reads resolve one supplied calendar date consistently. They return no data without `Organization.View`, are tenant-isolated by the fail-closed CoreHR context plus explicit same-tenant validation, and expose no employee/reporting/responsibility data. Non-Today read-only behavior is enforced by Change 2's UI; the server independently validates the command's explicit date/mode.

Temporary `/api/corehr/org-units` read adapters may project canonical *today* data only to keep the pre-Change-2 org-chart source runnable. They are marked for removal by `deliver-organization-workspace`; they cannot expose old mutable write semantics. Draft/setup/publish mutation endpoints are removed or return a controlled retired-capability response and must not forward into a second write model.

### 7. Organization capabilities replace Structure/publish authorization

Add `core.organization.view` and `core.organization.manage`, tenant scope only. Manage implies View at policy evaluation and authorizes all Organization mutations/types/cancellation/correction; View authorizes canonical exploration/history/upcoming changes. Controllers use only `ICoreAccessPolicyService.CanViewOrganization` / `CanManageOrganization`; residual `[Authorize(Roles = HRAdmin)]` and role-name decisions are removed. Existing Tenant Administrator seeding receives both organization grants. Platform Administrator receives neither by status alone.

`Structure.View`, `Structure.Manage`, `Structure.Publish`, setup permissions, and organization settings permissions are not fallback authorization for canonical Organization. `Structure.Publish` is removed with publish/reopen governance. Change 2 owns presentation of a view-only experience; Change 1 guarantees API denial and zero cross-tenant data disclosure.

### 8. Brownfield transition is a deliberate clean-slate replacement

Implement a forward replacement migration suitable for Fusion's non-production posture: remove old OrgUnit structural columns and unique `(TenantId, Name)` constraint, remove the obsolete responsible-manager data/path, create effective-state/type/code-reservation persistence and indexes, and rebuild the `OrgUnits` foreign-key target without changing its stable identity contract. Development databases are recreated/reset as part of applying this change; there is no transform of old live/draft/published data into invented historical truth.

Remove `DraftOrgUnit`, draft import/session runtime paths, Draft Structure Rules, TenantSetup approve/publish/reopen/complete structure governance, and `ReplaceLiveStructureAsync` as Organization authorities. Retain only narrowly necessary compilation/read compatibility described above, with a code comment and an OpenSpec task naming Change 2 as removal owner. The existing `/core/setup` and `/setup` UI/routing replacement is Change 2/3 work; this change must leave them incapable of publishing/replacing Organization truth.

`ResponsibleManagerEmployeeId` and its service/controller/DTO/test paths are removed from the canonical structural model. No runtime Performance source reference was found; a repository-wide consumer scan is a pre-removal verification gate. This change does not replace the concept with an effective-dated responsibility model because the locked Feature 4 contract does not define one.

## Risks / Trade-offs

- [Temporal tree validation loads a tenant-wide timeline] → validate only affected change-boundary dates with indexed state/parent/type lookups; defer visualization-scale optimization to Change 2.
- [Tenant writer lock reduces parallel Organization edits] → intentional: Organization mutations are relatively infrequent and correctness of a connected effective-dated tree outweighs parallel write throughput.
- [Clean-slate migration discards development data] → explicitly authorized; supply reset/recreate documentation and test fixture builders instead of brittle preservation logic.
- [Legacy draft/setup pages remain until later changes] → remove their authority now and keep only marked, minimal compatibility; Change 2 owns visual removal, Change 3 owns routing/navigation replacement.
- [Retiring responsible-manager behavior removes a prior contract] → repository-wide consumer scan and modified OpenSpec delta make the breaking removal explicit; no consumer may silently fall back to stale data.
- [Code correction changes an external reference] → require reason, audit, stronger confirmation contract, and permanent reservations; it is intentionally not an ordinary edit.

## Migration Plan

1. Add canonical domain/persistence and migration, remove old structural uniqueness/lifecycle fields and draft/publish authority, and recreate development databases.
2. Seed/query built-ins, issue the new organization grants, remove structure/publish grants and residual role gates, and update all CoreHR API clients/contracts to canonical endpoints or temporary read adapters.
3. Preserve `OrgUnits.Id` as the `WorkAssignment.OrgUnitId` target; rebuild the FK/index if required and prove the workforce contract in integration tests.
4. Remove responsible-manager runtime code and its modified capability after consumer scans/tests prove no active dependency.
5. Leave explicit compatibility markers and removal tests for Change 2; no compatibility route may write an alternate model.

Rollback during development is database recreation plus reverting the application/migration set. There is no production data rollback/migration promise because no production preservation is in scope.

## Open Questions

None that require product review. Exact route/DTO names, code normalization/length, audit storage binding, and EF table/index names remain implementation choices within the locked contract.
