# workforce-canonical-model Specification

## Purpose

Defines the canonical workforce chain `Employee -> Employment -> WorkAssignment -> ManagerRelationship`, the half-open effective-date convention, each entity's invariants, and removal of obsolete entities and direct `Employee` workforce fields.

## Requirements

### Requirement: Canonical workforce model structure

Core HR SHALL represent workforce truth with one canonical chain `Employee -> Employment -> WorkAssignment -> ManagerRelationship`. `Employee` SHALL remain the stable, tenant-scoped worker/person record and the Identity link target, holding only identity and profile fields. All workforce facts (employment state, employment type, organization, job title, location, reporting) SHALL be owned by `Employment`, `WorkAssignment`, or `ManagerRelationship`, and SHALL NOT be canonically owned by direct `Employee` fields.

#### Scenario: Employee retains only identity and profile data
- **WHEN** an employee record is created or read
- **THEN** the `Employee` aggregate exposes tenant id, stable employee key, employee number, and profile fields
- **AND** it does not expose canonical manager, organization, job title, work location, employment-status, hire-date, or employment-type fields as owned facts

#### Scenario: Workforce facts resolve through the canonical chain
- **WHEN** any business decision needs an employee's manager, organization, job title, employment state, or employment type as of a date
- **THEN** the value is resolved from `Employment`, `WorkAssignment`, and `ManagerRelationship`
- **AND** no business decision reads a direct `Employee` workforce field

### Requirement: Effective-date interval convention

All effective-dated workforce facts (`Employment`, `WorkAssignment`, `ManagerRelationship`) SHALL use a single half-open interval convention `[EffectiveFrom, EffectiveTo)` — inclusive of `EffectiveFrom`, exclusive of `EffectiveTo`. A null `EffectiveTo` SHALL mean open-ended (currently in effect). A fact SHALL be considered active "as of" date `D` when `EffectiveFrom <= D` and (`EffectiveTo` is null or `D < EffectiveTo`). This convention SHALL be applied consistently to manager changes, transfers/assignment changes, termination, rehire, overlap validation, import publication, and `asOfDate` resolution.

#### Scenario: As-of resolution uses half-open boundaries
- **WHEN** a fact has `EffectiveFrom = D1` and `EffectiveTo = D2`
- **THEN** it resolves as active for any date `D` where `D1 <= D < D2`
- **AND** it is not active on `D2`

#### Scenario: Adjacent intervals do not overlap
- **WHEN** one fact ends at `EffectiveTo = D` and the next begins at `EffectiveFrom = D`
- **THEN** overlap validation treats them as non-overlapping and contiguous

#### Scenario: Closing a fact sets exclusive end equal to the change date
- **WHEN** a business change (manager change, transfer, termination) closes an active fact effective date `D`
- **THEN** the closed fact's `EffectiveTo` is set to `D` and the new fact's `EffectiveFrom` is set to `D`
- **AND** an as-of query on `D` returns the new fact, not the closed one

### Requirement: Employment lifecycle entity

The system SHALL model `Employment` as a minimal, tenant-scoped record containing employee reference, start date (`EffectiveFrom`), optional end date (`EffectiveTo`), status, employment type, and source/provenance. There SHALL be at most one active employment per employee at any time. Rehire SHALL create a new `Employment` for the same `Employee` rather than reopening a prior employment.

#### Scenario: Employment carries employment type
- **WHEN** an employment record is created
- **THEN** its employment type is stored on the `Employment` record
- **AND** employment type is not stored on `Employee`

#### Scenario: Single active employment enforced
- **WHEN** a second active employment is requested for an employee who already has an active employment
- **THEN** the system rejects the operation with a validation error

#### Scenario: Rehire creates a new employment
- **WHEN** a previously terminated employee is rehired
- **THEN** a new `Employment` record is created with a new start date
- **AND** the previous (ended) employment record is preserved unchanged

#### Scenario: Employment is tenant-scoped
- **WHEN** employments are queried without a resolved tenant context
- **THEN** the fail-closed tenant query filter returns no employment rows

### Requirement: WorkAssignment entity owns organization context

The system SHALL model `WorkAssignment` as an effective-dated, tenant-scoped record belonging to an `Employment`, containing Organization Unit stable identity, plain-text job title, optional work location, primary flag, effective-from/effective-to, and source/provenance. An employee's canonical organization context SHALL come only from the primary `WorkAssignment.OrgUnitId`. There SHALL be at most one active primary work assignment per active employment. Assignment effective dates MUST fit within the parent employment's dates, and the Organization Unit identity MUST be valid in the tenant.

`WorkAssignment.OrgUnitId` SHALL reference the stable canonical Organizational Unit identity, not an effective-state row, business code, name, parent placement, or employee reporting relationship. An effective-dated Organizational Unit rename, type change, Move, or inactivation SHALL NOT rewrite the assignment's referenced identity; a change of an employee's assigned unit remains a Work Assignment operation.

#### Scenario: Primary work assignment provides organization context
- **WHEN** an employee's current organization is resolved as of a date
- **THEN** the value comes from the employee's active primary `WorkAssignment.OrgUnitId` effective on that date

#### Scenario: Overlapping active primary assignments rejected
- **WHEN** a new active primary work assignment would overlap an existing active primary work assignment for the same employment
- **THEN** the system rejects the operation with a validation error

#### Scenario: Assignment dates must fit employment window
- **WHEN** a work assignment effective range falls outside its employment start/end window
- **THEN** the system rejects the operation with a validation error

#### Scenario: Assignment organization unit must be tenant-valid
- **WHEN** a work assignment references an organization unit that does not exist in the tenant
- **THEN** the system rejects the operation with a validation error

#### Scenario: Organizational structure changes preserve assignment identity
- **WHEN** the referenced Organizational Unit is renamed, retyped, moved, or otherwise changes effective structural state
- **THEN** the Work Assignment retains the same `OrgUnitId`
- **AND** only the unit's resolved Organization attributes or ancestry may differ as of the requested date

### Requirement: ManagerRelationship entity

The system SHALL model `ManagerRelationship` as an effective-dated, tenant-scoped relationship linking a subject `WorkAssignment` to a manager `WorkAssignment`, with a type, effective-from/effective-to, and source/provenance. At most one active primary manager relationship SHALL exist for a primary assignment at a date. The relationship SHALL forbid self-management, cross-tenant links, and cycles in the primary management chain, and SHALL NOT grant any permission.

#### Scenario: Self-management rejected
- **WHEN** a manager relationship would make an employee their own manager
- **THEN** the system rejects the operation with a validation error

#### Scenario: Manager cycle rejected
- **WHEN** a new primary manager relationship would create a cycle in the primary management chain
- **THEN** the system rejects the operation with a validation error

#### Scenario: Cross-tenant manager rejected
- **WHEN** a manager relationship references a manager work assignment in a different tenant
- **THEN** the system rejects the operation with a validation error

#### Scenario: Manager relationship does not grant permissions
- **WHEN** an active manager relationship exists between two employees
- **THEN** no permission is granted by the relationship itself
- **AND** authorization continues to require explicit server-side permission checks

### Requirement: Removal of obsolete workforce runtime code

The system SHALL NOT retain `Position`, `EmployeePositionAssignment`, `EmployeeOrgMembership`, or `OrgMembershipType` as runtime code. Their entities, EF configurations, `CoreHRDbContext` DbSets, tenant query filters, EF model-snapshot references, database tables, DTOs, services, and behavior-asserting tests SHALL be removed. `EmployeeReportingRelationship` SHALL be refactored so its subject/manager references point to `WorkAssignment` records instead of position-assignment records.

#### Scenario: Position model is absent from runtime
- **WHEN** the codebase is searched for runtime references to `Position`, `EmployeePositionAssignment`, `EmployeeOrgMembership`, or `OrgMembershipType`
- **THEN** no runtime entity, configuration, DbSet, query filter, service, or supported test depends on them
- **AND** only historical migrations and the final cleanup migration may reference them

#### Scenario: Reporting relationship references work assignments
- **WHEN** a manager relationship is persisted
- **THEN** its subject and manager references resolve to `WorkAssignment` records
- **AND** no field references a position-assignment id

### Requirement: Removal of direct Employee workforce fields

After staged migration, the system SHALL remove the direct `Employee` workforce fields `ManagerId`, `OrgUnitId`, `JobTitle`, `WorkLocation`, `HireDate`, `Status`, and `EmploymentType`, together with `Employee.AssignManager`, `Employee.AssignOrgUnit`, and `Employee.Activate()`/`Employee.Deactivate()` where they only flip legacy status, their EF mappings, and their database columns. These fields SHALL NOT remain as active projections, fallback reads, or dual-written values, and SHALL NOT remain as a second canonical employment model in the final implementation.

#### Scenario: Legacy workforce and employment fields removed before completion
- **WHEN** the hardening change is complete
- **THEN** `Employee` has no `ManagerId`, `OrgUnitId`, `JobTitle`, `WorkLocation`, `HireDate`, `Status`, or `EmploymentType` property
- **AND** the corresponding database columns have been dropped by forward migration

#### Scenario: No second canonical employment model on Employee
- **WHEN** employment state, hire date, or employment type is needed
- **THEN** it is resolved from the canonical `Employment` record
- **AND** no business decision reads employment state from `Employee`

#### Scenario: No fallback read of legacy fields
- **WHEN** a canonical fact cannot be resolved
- **THEN** the system reports missing/invalid data rather than falling back to a legacy `Employee` field
