## ADDED Requirements

### Requirement: Terminate employee action

The system SHALL expose `POST /api/corehr/employees/{id}/terminate` accepting a concurrency token, an effective date, and an optional concise note. Termination SHALL end the active `Employment`, its active primary `WorkAssignment`, and the manager relationships in which the terminating employee's assignment is the **subject** (the employee's own reporting links), at the effective date, while preserving the `Employee` record and all history. Termination SHALL NOT automatically close relationships in which the terminating employee's assignment is the **manager** of direct reports; those incoming direct-report relationships MUST already be ended through explicit reassignment effective no later than the termination date, otherwise termination is blocked. Termination SHALL NOT be performed through generic employee update, and SHALL NOT use the `DELETE` route.

#### Scenario: Termination ends subject-side relationships only
- **WHEN** an active employee is terminated effective a date
- **THEN** the active employment, its active primary work assignment, and the manager relationships where the employee's assignment is the subject are ended at that date
- **AND** the `Employee` record and prior history are preserved

#### Scenario: Termination does not auto-close manager-side relationships
- **WHEN** an employee who is the manager of direct reports is terminated
- **THEN** the system does not automatically close the relationships where the employee's assignment is the manager
- **AND** termination proceeds only if those incoming direct-report relationships are already ended via reassignment effective no later than the termination date

#### Scenario: Termination requires active employment
- **WHEN** termination is requested for an employee with no active employment
- **THEN** the system rejects the request with a validation error

#### Scenario: Termination not available via generic update
- **WHEN** a generic employee update attempts to end employment
- **THEN** the update is rejected and the caller is directed to the terminate action

### Requirement: Termination direct-report blocking

Termination SHALL be blocked when the terminating employee has active primary direct reports who lack a replacement primary manager effective on or before the termination date. The system SHALL NOT automatically close subordinate manager relationships or leave employees unmanaged. The blocking response SHALL identify the affected direct reports.

#### Scenario: Termination blocked with unmanaged direct reports
- **WHEN** termination is requested and at least one active primary direct report has no replacement manager effective on or before the termination date
- **THEN** the system rejects the termination with a blocking error listing the affected direct reports

#### Scenario: Termination proceeds after reassignment
- **WHEN** all affected direct reports have a replacement primary manager effective on or before the termination date
- **THEN** the termination is allowed to proceed

#### Scenario: No automatic subordinate reassignment
- **WHEN** termination would otherwise leave direct reports unmanaged
- **THEN** the system does not auto-assign a skip-level, delegate, or fallback manager

### Requirement: Rehire employee action

The system SHALL expose `POST /api/corehr/employees/{id}/rehire` accepting a concurrency token, an employment start/effective date, work assignment details (org unit, job title, optional work location), and an optional manager. Rehire SHALL reuse the `Employee`, create a new `Employment` and a new primary `WorkAssignment`, and create a manager relationship when a valid manager is provided. Rehire SHALL NOT reopen or overwrite the previous employment, and SHALL NOT be performed through generic employee update.

#### Scenario: Rehire creates new employment and assignment
- **WHEN** a terminated employee is rehired
- **THEN** a new employment and a new primary work assignment are created for the same employee
- **AND** the previous employment remains ended and unchanged

#### Scenario: Rehire requires no active employment
- **WHEN** rehire is requested for an employee who already has an active employment
- **THEN** the system rejects the request with a validation error

### Requirement: Change manager action

The system SHALL expose `POST /api/corehr/employees/{id}/change-manager` accepting a concurrency token, a new manager reference, and an effective date. The operation SHALL atomically end the current active primary manager relationship and create the new one, validating that subject and manager have active employment and primary work assignment at the effective date, are in the same tenant, are not the same employee, and do not form a cycle. When no current manager exists, it SHALL act as the first manager assignment.

#### Scenario: Manager change is atomic and effective-dated
- **WHEN** a manager change is requested effective a date
- **THEN** the existing active primary manager relationship ends at that date and a new one starts at that date in one atomic operation
- **AND** an audit entry is recorded

#### Scenario: Invalid manager change rejected
- **WHEN** the requested manager is the subject, in another tenant, lacks an active assignment at the effective date, or would create a cycle
- **THEN** the system rejects the change with a validation error

#### Scenario: First manager assignment via change-manager
- **WHEN** an employee with no current manager receives a change-manager request
- **THEN** a new primary manager relationship is created effective the given date

#### Scenario: Change manager authorization is server-side
- **WHEN** a user without reporting-management permission calls change-manager
- **THEN** the request is denied

### Requirement: Deny-by-default authorization for lifecycle actions

The terminate, rehire, and change-manager actions SHALL enforce server-side, deny-by-default authorization and tenant scoping. A caller without the required permission SHALL be denied, and a caller SHALL NOT act on an employee outside their tenant.

#### Scenario: Terminate denied without permission
- **WHEN** a user without the required workforce-management permission calls terminate
- **THEN** the request is denied and no employment is ended

#### Scenario: Rehire denied without permission
- **WHEN** a user without the required workforce-management permission calls rehire
- **THEN** the request is denied and no employment is created

#### Scenario: Lifecycle actions denied across tenants
- **WHEN** a user invokes terminate, rehire, or change-manager on an employee in another tenant
- **THEN** the request is denied

### Requirement: Removal of legacy lifecycle routes

The system SHALL remove the legacy `DELETE /api/corehr/employees/{id}` (deactivate) and `POST /api/corehr/employees/{id}/reactivate` routes, their commands/handlers, related DTOs, and the corresponding frontend hooks before completion. Status-flip deactivate/reactivate behavior SHALL NOT remain as supported runtime routes.

#### Scenario: Legacy lifecycle routes absent
- **WHEN** the hardening change is complete
- **THEN** the deactivate `DELETE` route and the `reactivate` route no longer exist
- **AND** lifecycle changes are only available through terminate and rehire actions
