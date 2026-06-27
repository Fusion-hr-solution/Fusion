## Why

Core HR currently carries two overlapping, divergent workforce models: direct current-state fields on `Employee` (`ManagerId`, `OrgUnitId`, `JobTitle`, `WorkLocation`) and a set of provisional effective-dated entities (`EmployeeOrgMembership`, `EmployeePositionAssignment`, `EmployeeReportingRelationship`, `Position`) that are partially wired and incompletely owned. Business decisions, imports, authorization, and Performance contracts still resolve from the legacy direct fields, so Core does not yet have a single defensible source of workforce truth. This change hardens Core onto one canonical, effective-dated model so that employment history, organizational assignment, and reporting relationships are correct over time and safe to build the rest of the platform on.

## What Changes

- Introduce one canonical workforce model: `Employee -> Employment -> WorkAssignment -> ManagerRelationship`, all tenant-scoped and effective-dated where correctness depends on history.
  - `Employment`: minimal employment record (employee, start date, optional end date, status, employment type, source/provenance). One active employment per employee; rehire creates a new employment. `Employment` is the sole owner of employment truth previously held on `Employee` (`HireDate`, `Status`, `EmploymentType`).
  - `WorkAssignment`: effective-dated org unit + plain-text job title + optional location + primary flag, belonging to an `Employment`. Canonical organization context comes only from `WorkAssignment.OrgUnitId`.
  - `ManagerRelationship`: effective-dated manager link between work assignments, separate from permissions, cycle-safe and self-management-safe.
  - All three effective-dated facts use one half-open interval convention `[EffectiveFrom, EffectiveTo)` (inclusive start, exclusive end; null end = open) applied consistently to manager changes, transfers, termination, rehire, overlap validation, import, and `asOfDate` resolution.
- **BREAKING** Remove obsolete runtime code with no permanent compatibility layer: `Position`, `EmployeePositionAssignment` (replaced by `WorkAssignment`), and `EmployeeOrgMembership` (replaced by `WorkAssignment.OrgUnitId`) — entities, configurations, DbSets, query filters, DTOs, services, frontend code, and tests.
- **BREAKING** Remove direct `Employee` workforce and employment fields (`ManagerId`, `OrgUnitId`, `JobTitle`, `WorkLocation`, `HireDate`, `Status`, `EmploymentType`) and their `AssignManager`/`AssignOrgUnit`/`Activate`/`Deactivate` behavior after staged migration; legacy columns are migration sources only (backfilled into `Employment`/`WorkAssignment`) and are dropped before completion. None of these remain as a second canonical employment model.
- Refactor employee endpoints **in place** (keep `api/corehr/employees` paths) to a composed `EmployeeDetails` contract covering Core-owned Profile, Employment, Work Assignment, and Manager facts; the Core frontend migrates to a single **Employee Details** workflow with Profile / Employment / Work Assignment / Manager / Access sections.
- Replace status-flip lifecycle with explicit effective-dated actions: `POST {id}/terminate`, `POST {id}/rehire`, `POST {id}/change-manager`. Termination is **blocked** when active primary direct reports lack a replacement manager.
- Evolve employee import to stage every row, validate the whole batch, preview proposed canonical changes, and publish **all-or-nothing** per batch; support creates and controlled updates matched by tenant-scoped employee number, with a required batch effective date (optional row-level override) and a batch-level import mode (`BusinessChange` / `Correction`). Missing rows never imply deletion/termination.
- Evolve Core workforce contracts to resolve from canonical facts with explicit `asOfDate` where historical correctness matters, preserving DTO shape for Performance P1 where safe and avoiding exposure of raw canonical entity identities.
- Keep `OrgUnit.ResponsibleManagerEmployeeId` as a validated org-administration attribute (**Responsible manager**), separate from `ManagerRelationship`.
- Add a focused append-only `WorkforceAuditEntry` for material workforce actions (employment lifecycle, assignment, manager change, import publication/correction, org-unit responsible-manager change).
- Keep **Access** visually inside Employee Details but load it independently through Identity-owned workforce-account/access APIs; Core `EmployeeDetails` must not include Identity access state or call Identity to build its response.
- Perform a staged migration inside this same change with fail-fast backfill validation (invalid/ambiguous/cross-tenant/overlapping data must be repaired, not defaulted) and remove all retired runtime surface before completion.

## Capabilities

### New Capabilities

- `workforce-canonical-model`: The `Employee -> Employment -> WorkAssignment -> ManagerRelationship` domain — entities, fields, effective-dating, primary/overlap/cycle/self-management rules, tenant scoping, and the removal of `Position`, `EmployeePositionAssignment`, `EmployeeOrgMembership`, and direct `Employee` workforce fields.
- `employee-details`: The composed `EmployeeDetails` read model and the in-place refactor of `api/corehr/employees` create/update/read endpoints into Core-owned Profile + Employment + Work Assignment + Manager facts, plus the single Employee Details frontend workflow.
- `employee-lifecycle-actions`: Explicit `terminate`, `rehire`, and `change-manager` actions over the canonical model, including termination direct-report blocking and manager-relationship validation.
- `employee-import`: Import staging, two-level validation, change-set preview, all-or-nothing publication, create/controlled-update matching by employee number, batch effective date with row override, and batch import mode.
- `workforce-contracts`: Core public and internal campaign workforce contracts resolved from canonical facts with `asOfDate`, and the Performance P1 consumption boundary.
- `org-unit-responsible-manager`: The validated, tenant-scoped, audited `OrgUnit.ResponsibleManagerEmployeeId` org-administration attribute.
- `workforce-audit`: The append-only tenant-scoped `WorkforceAuditEntry` model and per-action provenance on canonical facts.
- `identity-access-composition`: Independent composition of the Identity-owned Access section inside the Core Employee Details workflow and clarification of route ownership for Identity endpoints on CoreHR-style paths.
- `workforce-migration`: Staged in-change migration, backfill sequencing, fail-fast validation, and removal of retired runtime surface with cross-boundary completion verification.

### Modified Capabilities

<!-- No existing OpenSpec specs in openspec/specs/; all behavior is captured as new capabilities above. -->

## Impact

- **Core HR backend**: `Employee` entity and configuration; new `Employment`, `WorkAssignment`, `ManagerRelationship`, `WorkforceAuditEntry` entities/configurations; removal of `Position`, `EmployeePositionAssignment`, `EmployeeOrgMembership`, `OrgMembershipType`; `CoreHRDbContext` DbSets and tenant query filters; `EmployeesController` (create/update/profile/list, new terminate/rehire/change-manager routes, removed delete/reactivate); `EmployeeImportWorkflowService` and import session/history/DTO model; `WorkforceContractService`, `CampaignWorkforceContextService`, `ReportingRelationshipService`, `EmployeeHierarchyService`; org-unit create/update handlers; readiness/authorization handlers; canonical resolver services.
- **EF migrations**: Forward migrations to add canonical tables, backfill, validate fail-fast, and drop legacy columns/tables; fresh-DB and upgrade-from-current-schema paths.
- **Core frontend** (`Frontend/apps/core`): Employee Details workspace, create/edit dialogs and sheets, roster/profile/org-chart consumers, import workspace (batch effective date, import mode, change-set preview), lifecycle action hooks (`useTerminateEmployee`, `useRehireEmployee`, `useChangeManager`), removal of `useDeactivateEmployee`/`useReactivateEmployee`.
- **Identity**: Boundary clarification for `WorkforceAccountsController` (CoreHR-style path, Identity-owned); review of `ApplicationUser` profile fields (`JobTitle`/`Department`) so Identity is not a second workforce source of truth. Access composition stays Identity-owned.
- **Performance**: `ICoreWorkforceClient` consumers, cycle readiness/publish, snapshots, and `CampaignWorkforceDeltaResolver` continue against preserved contract shape with canonical-resolved values and `asOfDate`; campaign internal ids move from position-assignment to work-assignment semantics without leaking raw canonical entity identities.
- **Tenancy & permissions**: All new entities, endpoints, imports, audit entries, and relationships are tenant-scoped with server-side, deny-by-default authorization; manager relationships never grant permissions; Core fail-closed query filters extend to new entities.
- **Tests**: Cross-boundary verification across Core backend/frontend, Identity Access composition, Performance contracts, migration/backfill, and tenant isolation; removal of obsolete tests for retired model pieces.
