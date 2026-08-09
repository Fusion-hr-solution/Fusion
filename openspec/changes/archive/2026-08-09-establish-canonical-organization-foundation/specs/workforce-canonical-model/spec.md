## MODIFIED Requirements

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
- **WHEN** a work assignment references an Organization Unit identity that does not exist in the tenant
- **THEN** the system rejects the operation with a validation error

#### Scenario: Organizational structure changes preserve assignment identity
- **WHEN** the referenced Organizational Unit is renamed, retyped, moved, or otherwise changes effective structural state
- **THEN** the Work Assignment retains the same `OrgUnitId`
- **AND** only the unit's resolved Organization attributes or ancestry may differ as of the requested date
