# employee-details Specification

## Purpose

Defines the composed, Core-owned `EmployeeDetails` read model and the in-place refactor of employee endpoints and the single Employee Details frontend workflow, with authorization and tenancy resolved from canonical facts.

## Requirements

### Requirement: Composed EmployeeDetails read model

Core HR SHALL expose a composed `EmployeeDetails` read model containing only Core-owned facts: profile data, current employment, current primary work assignment (organization, job title, optional location, effective dates), current primary manager relationship, readiness/data-quality indicators, and relevant history summaries. `EmployeeDetails` SHALL NOT include Identity account, invitation, or access-profile state, and Core SHALL NOT call Identity to assemble the response.

#### Scenario: EmployeeDetails composes Core-owned facts
- **WHEN** a client reads employee details by id or by employee key
- **THEN** the response includes profile, current employment, primary work assignment, and primary manager resolved from canonical facts
- **AND** it includes readiness/data-quality indicators

#### Scenario: EmployeeDetails excludes Identity access state
- **WHEN** the `EmployeeDetails` contract is assembled
- **THEN** it contains no Identity account, invite, or access-profile fields
- **AND** Core makes no call to Identity to build the response

#### Scenario: EmployeeDetails read is tenant-scoped
- **WHEN** an employee from another tenant is requested
- **THEN** the fail-closed tenant filter prevents the record from being returned

### Requirement: Employee endpoints refactored in place

The system SHALL keep the existing employee endpoint paths (`POST api/corehr/employees`, `PUT api/corehr/employees/{id}`, `GET api/corehr/employees`, `GET api/corehr/employees/{id}`, profile reads) and refactor their contracts in place to the composed `EmployeeDetails` model. The system SHALL NOT introduce parallel `/employee-details`, `/employment`, or `/work-assignments` CRUD endpoints. Create and update SHALL orchestrate distinct canonical domain services atomically.

#### Scenario: Create orchestrates canonical records atomically
- **WHEN** an employee is created with profile, employment, primary work assignment, and optional manager
- **THEN** the endpoint creates `Employee`, `Employment`, primary `WorkAssignment`, and optional `ManagerRelationship` in one atomic operation
- **AND** returns the composed `EmployeeDetails`

#### Scenario: Create rolls back fully on failure
- **WHEN** any part of the atomic create fails
- **THEN** no `Employee`, `Employment`, `WorkAssignment`, or `ManagerRelationship` record is persisted

#### Scenario: Update is not a generic patch
- **WHEN** a `PUT` request attempts a lifecycle operation that requires a dedicated action (termination, rehire, or manager change)
- **THEN** the endpoint rejects it and directs the caller to the explicit action
- **AND** the update delegates only to explicit profile/employment/assignment domain services for permitted changes

#### Scenario: List items source facts from canonical resolvers
- **WHEN** the employee list endpoint returns items
- **THEN** each item's employment, organization, job title, and manager values are resolved from canonical facts, not from direct `Employee` fields

### Requirement: Single Employee Details frontend workflow

The Core frontend SHALL present one Employee Details workflow with the sections Profile, Employment, Work Assignment, Manager, and Access. It SHALL NOT expose separate generic CRUD screens for `Employment`, `WorkAssignment`, or `ManagerRelationship`. The user edits an employee, not database tables.

#### Scenario: Employee Details shows all sections
- **WHEN** an operator opens an employee
- **THEN** the workspace shows Profile, Employment, Work Assignment, Manager, and Access sections in one coherent workflow

#### Scenario: No per-entity CRUD screens
- **WHEN** the Core frontend is navigated
- **THEN** there is no standalone CRUD management screen for employments, work assignments, or manager relationships

### Requirement: Authorization and tenancy on employee endpoints

Employee endpoints SHALL enforce server-side, deny-by-default authorization and tenant isolation. Direct-report-scoped permissions SHALL be evaluated from canonical `ManagerRelationship` facts rather than legacy direct manager fields.

#### Scenario: Direct-report scope uses canonical manager facts
- **WHEN** a reporting-scoped user accesses employees within their direct-report scope
- **THEN** the scope is computed from active primary `ManagerRelationship` facts as of the current date

#### Scenario: Unauthorized access denied by default
- **WHEN** a user without the required permission calls an employee endpoint
- **THEN** the request is denied
