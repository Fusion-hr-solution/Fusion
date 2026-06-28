# workforce-contracts Specification

## Purpose

Defines how Core workforce contract services resolve facts from the canonical model, support `asOfDate`, expose resolved facts (not entity identities) to Performance, drive richer campaign launch deltas, and enforce tenant isolation.

## Requirements

### Requirement: Workforce contracts resolve from canonical facts

Core workforce contract services (`WorkforceContractService`, `CampaignWorkforceContextService`) SHALL resolve employee, organization, job title, manager, and manager-chain facts from the canonical `Employment`, `WorkAssignment`, and `ManagerRelationship` model. They SHALL NOT read direct `Employee` workforce fields, `EmployeePositionAssignment`, `Position`, or `EmployeeOrgMembership`.

#### Scenario: Org-unit members resolved from work assignments
- **WHEN** org-unit members are requested for an organization scope
- **THEN** members are the employees whose effective primary `WorkAssignment.OrgUnitId` is in scope as of the requested date

#### Scenario: Manager chain resolved from manager relationships
- **WHEN** an employee's manager chain is requested
- **THEN** the chain is built from active primary `ManagerRelationship` facts

#### Scenario: No legacy or provisional sources
- **WHEN** any workforce contract value is resolved
- **THEN** it is not sourced from direct `Employee` fields, position assignments, positions, or org memberships

### Requirement: asOfDate support on workforce reads

Workforce reads that depend on historical correctness SHALL accept an explicit `asOfDate` and resolve effective-dated facts as of that date. Where a current screen requires it for compatibility, the read MAY default `asOfDate` to today. New `asOfDate` support and additional resolved fields SHALL be added through non-breaking contract evolution where the existing DTO can carry them safely.

#### Scenario: As-of resolution returns historical truth
- **WHEN** a workforce read is requested with an `asOfDate` in the past
- **THEN** the returned organization, job title, and manager reflect the facts effective on that date

#### Scenario: Default to today when omitted
- **WHEN** a current-screen workforce read omits `asOfDate`
- **THEN** the read resolves facts as of today

### Requirement: Performance consumes resolved facts, not entity identities

The Performance P1 boundary SHALL continue to consume Core workforce facts through `ICoreWorkforceClient` over the existing workforce contract surface, not through employee CRUD/detail endpoints. Core SHALL provide resolved workforce facts (stable employee id, active status as of date, organization unit, job title, optional location, primary manager, manager chain where required, relevant effective dates). Core SHALL NOT expose raw `Employment`, `WorkAssignment`, or `ManagerRelationship` database identities to Performance unless a concrete workflow requires entity identity. Campaign internal ids previously tied to position assignments SHALL move to work-assignment semantics without leaking internal structure as a permanent contract obligation.

#### Scenario: Resolved facts returned to Performance
- **WHEN** Performance requests workforce facts for a cycle as of a date
- **THEN** Core returns resolved employee/organization/job-title/manager facts derived from canonical records

#### Scenario: Raw canonical identities not exposed
- **WHEN** the workforce contract response is produced
- **THEN** it does not expose raw `Employment`, `WorkAssignment`, or `ManagerRelationship` database identities unless a concrete workflow requires them

#### Scenario: Endpoint versioned only when meaning cannot be preserved
- **WHEN** an existing DTO cannot safely distinguish current value from as-of resolved value
- **THEN** that endpoint is versioned or replaced rather than overloaded

### Requirement: Campaign launch delta uses richer canonical context

Performance campaign launch-readiness delta SHALL use the richer Core campaign workforce context/delta (organization, manager chain, primary manager, assignment changes) rather than only active/missing employee checks. The campaign context/delta SHALL expose professional workforce answers, not internal entity structure.

#### Scenario: Delta detects organization and manager changes
- **WHEN** a launch-readiness delta is computed after a primary organization or manager change
- **THEN** the delta reports the organization/manager change, not only active/missing status

#### Scenario: Snapshot values resolved from canonical facts
- **WHEN** Performance snapshots participants during campaign preparation
- **THEN** snapshotted job title, organization, and manager are resolved from canonical Core facts as of the requested date

### Requirement: Tenant isolation on workforce contracts

All workforce contract reads and campaign context/delta operations SHALL enforce tenant isolation, including internal service-authorized campaign endpoints.

#### Scenario: Cross-tenant workforce read denied
- **WHEN** a workforce contract or campaign endpoint is invoked for a tenant the caller is not scoped to
- **THEN** no cross-tenant workforce facts are returned
