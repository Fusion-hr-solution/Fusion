## ADDED Requirements

### Requirement: Access section loads independently from Identity

The Core Employee Details workflow SHALL render an **Access** section that loads account status, invitation status, access profile, and access actions through the existing Identity-owned workforce-account/access API, independently from the Core employee-detail load. The Access section SHALL display its own loading and error state, and Identity unavailability SHALL NOT prevent the Core employee record from loading.

#### Scenario: Access loads as an independent data source
- **WHEN** an operator opens Employee Details
- **THEN** Core profile/employment/assignment/manager facts load from Core
- **AND** account/invite/access-profile state loads separately from Identity

#### Scenario: Identity failure does not block Core details
- **WHEN** the Identity access API is unavailable
- **THEN** the Core employee details still render
- **AND** the Access section shows its own error state

#### Scenario: Access actions use Identity authorization
- **WHEN** an access action (invite, resend, reactivate, deactivate, assign profile) is performed
- **THEN** it is authorized and audited by Identity

### Requirement: EmployeeDetails excludes Identity access state

The Core `EmployeeDetails` contract SHALL contain only Core-owned facts and SHALL NOT include Identity account, invitation, or access-profile state. Core SHALL NOT call Identity to assemble the employee-details response.

#### Scenario: No Identity dependency in EmployeeDetails assembly
- **WHEN** Core builds the `EmployeeDetails` response
- **THEN** it makes no call to Identity
- **AND** the response contains no Identity access fields

### Requirement: Route ownership clarity for Identity workforce-account endpoints

The system SHALL document `api/corehr/employees/workforce-accounts` as Identity-owned despite its CoreHR-style path, in proposal/design artifacts and API/Gateway documentation. Identity profile fields that duplicate workforce data (such as `ApplicationUser.JobTitle`) SHALL be reviewed so Identity does not become a second workforce source of truth, and SHALL be removed or stop being synced if unused or duplicative.

#### Scenario: Workforce-account route ownership documented
- **WHEN** the workforce-account endpoint ownership is reviewed
- **THEN** it is explicitly documented as Identity-owned

#### Scenario: Identity does not duplicate workforce truth
- **WHEN** Identity profile fields duplicating Core workforce facts are reviewed
- **THEN** unused or duplicative workforce fields are removed or no longer treated as a workforce source of truth
