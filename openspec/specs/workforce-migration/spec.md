# workforce-migration Specification

## Purpose

Defines the staged, in-change migration to the canonical workforce model: backfill sequencing and precedence, fail-fast validation, removal of the retired runtime surface, and cross-boundary completion verification.

## Requirements

### Requirement: Staged migration within the same change

The hardening change SHALL perform a staged migration in three phases inside this same change: (1) add the canonical model and backfill from legacy fields and provisional entities; (2) move all runtime reads and writes to canonical services; (3) remove the legacy/provisional runtime surface and drop legacy columns/tables by forward migration. Permanent cleanup SHALL NOT be split into a later change. The final result SHALL have one canonical model and no permanent compatibility layer.

#### Scenario: All three phases complete in one change
- **WHEN** the hardening change is complete
- **THEN** canonical entities exist, all runtime behavior uses them, and the legacy/provisional surface is removed
- **AND** no permanent compatibility layer remains

#### Scenario: Temporary migration-only code removed
- **WHEN** the change is complete
- **THEN** backfill scripts, transitional readers, and temporary projection writers have been deleted

### Requirement: Backfill sequencing from legacy data

Backfill SHALL create canonical facts in order: one `Employment` per existing employee (`EffectiveFrom` from `HireDate`, status from `Employee.Status`, employment type from `Employee.EmploymentType`, source `Migration`), then one primary `WorkAssignment` per employee with current-state data (org unit resolved per the organization-context precedence rule, job title from `JobTitle`, location from `WorkLocation`), then `ManagerRelationship` rows after assignments exist (from `Employee.ManagerId`, linking subject and manager primary assignments). All three direct employment fields (`HireDate`, `Status`, `EmploymentType`) SHALL have `Employment` as their backfill destination. Legacy columns and provisional rows SHALL be read only by migration/backfill code, never by business behavior.

#### Scenario: Employment fields backfilled to Employment
- **WHEN** backfill runs
- **THEN** `Employee.HireDate` maps to `Employment.EffectiveFrom`, `Employee.Status` maps to `Employment.Status`, and `Employee.EmploymentType` maps to `Employment` employment type

#### Scenario: Employment backfilled before assignment
- **WHEN** backfill runs
- **THEN** employment records are created before work assignments
- **AND** manager relationships are created after work assignments exist

#### Scenario: Legacy columns not read by business behavior during migration
- **WHEN** business behavior runs during the migration
- **THEN** it reads canonical facts, not legacy columns

### Requirement: Deterministic organization-context backfill precedence

Backfill of a primary `WorkAssignment`'s organization context SHALL apply a single deterministic source priority: (1) already-existing canonical-compatible assignment data, then (2) reliable primary/home `EmployeeOrgMembership`, then (3) legacy `Employee.OrgUnitId`. When higher- and lower-priority sources disagree, or when multiple active primary/home memberships exist for one employee at the same date, the backfill SHALL fail fast with actionable diagnostics identifying the employee and conflicting sources. The backfill SHALL NOT silently overwrite one source with another or pick arbitrarily.

#### Scenario: Highest-priority source wins when consistent
- **WHEN** existing assignment data, primary/home membership, and `Employee.OrgUnitId` agree or only the higher-priority source is present
- **THEN** the organization context is taken from the highest-priority available source

#### Scenario: Conflicting organization sources fail fast
- **WHEN** the available organization sources disagree for an employee
- **THEN** the backfill fails with a diagnostic identifying the employee and the conflicting source values
- **AND** no canonical organization context is written for that employee until repaired

#### Scenario: Multiple active primary memberships fail fast
- **WHEN** an employee has more than one active primary/home `EmployeeOrgMembership` at the same date
- **THEN** the backfill reports a data-quality conflict rather than choosing one silently

### Requirement: Fail-fast backfill validation

Migration/backfill validation SHALL be deterministic, tenant-aware, and fail-fast. When it finds invalid employee references, missing employee numbers needed for matching, missing or inactive org units, cross-tenant links, overlapping effective-dated facts, self-management, manager cycles, multiple active primary/home memberships for one employee/date, or invalid responsible-manager references, it SHALL fail the migration with actionable diagnostics and require data repair. The system SHALL NOT silently quarantine invalid rows and continue, and SHALL NOT apply deterministic defaults that create canonical truth operators cannot defend.

#### Scenario: Invalid data fails the migration
- **WHEN** backfill validation finds invalid, ambiguous, overlapping, or cross-tenant workforce data
- **THEN** the migration fails with actionable diagnostics
- **AND** no canonical workforce truth is fabricated from the invalid data

#### Scenario: No silent defaults
- **WHEN** a non-critical gap is encountered during backfill
- **THEN** the system does not invent an employment, assignment, or manager relationship from ambiguous data

#### Scenario: Completion blocked until repair
- **WHEN** backfill validation fails
- **THEN** the hardening change cannot be completed until the source data is repaired and validation passes

### Requirement: Removal of retired runtime surface before completion

Before completion, the system SHALL remove the legacy `Employee` workforce and employment properties and columns, removed-entity mappings/tables, obsolete request/response DTO fields, obsolete frontend form fields and types, and obsolete tests, and SHALL confirm via repository search that no runtime references remain to retired identifiers (`Employee.ManagerId`, `AssignManager`, `Employee.OrgUnitId`, `AssignOrgUnit`, `Employee.JobTitle`, `Employee.WorkLocation`, `Employee.HireDate`, `Employee.Status`, `Employee.EmploymentType`, `EmployeeOrgMembership`, `OrgMembershipType`, `EmployeePositionAssignment`, `Position`, `LegacyPositionTitle`, `SubjectPositionAssignmentId`, `ManagerPositionAssignmentId`). Only historical migrations and the final cleanup migration MAY reference retired identifiers.

#### Scenario: No runtime references to retired identifiers
- **WHEN** the codebase is searched after cleanup
- **THEN** no runtime fallback read, dual write, DTO exposing deleted storage, or behavior-preserving test references the retired identifiers

#### Scenario: Forward migration drops legacy columns and tables
- **WHEN** the cleanup migration runs
- **THEN** legacy employee workforce columns and removed-entity tables are dropped

### Requirement: Cross-boundary completion verification

Completion SHALL require cross-boundary verification covering Core backend domain/lifecycle/import/contracts/audit, EF migration and backfill from representative data, fresh-database and upgrade-from-current-schema migrations, Core frontend Employee Details and import flows, Identity Access composition and account-link behavior, Performance P1 workforce consumers/snapshots/manager-resolution/delta, and tenant isolation for all new entities/endpoints/imports/audit/relationships. Completion evidence SHALL include: affected projects build, targeted tests pass, migrations apply, no pending EF model changes, backfill validation passes, and no runtime references to the retired model. Unrelated full-platform regression work is NOT required.

#### Scenario: End-to-end scenarios verified
- **WHEN** completion verification runs
- **THEN** create employee, update details, import creates and updates, manager change, work-assignment change, termination with direct-report blocking, rehire, Performance as-of resolution, and independent Access loading are all exercised

#### Scenario: Migration health verified
- **WHEN** completion verification runs
- **THEN** fresh and upgrade migrations apply with no pending EF model changes
- **AND** backfill validation passes

#### Scenario: Tenant isolation verified for new surface
- **WHEN** completion verification runs
- **THEN** tenant isolation is verified for all new entities, endpoints, imports, audit entries, and relationships
