# performance-objective-planning-configuration Specification

## Purpose
TBD - created by archiving change performance-p1-1-configuration-alignment. Update Purpose after archive.
## Requirements
### Requirement: Tenant configuration dimensions

The system SHALL let Tenant Admins manage exactly the tenant objective-planning configuration dimensions: maximum objective count, allowed weight menu, and enabled measurement methods.

Objective weights SHALL represent relative business importance inside a future employee objective plan. Tenant Admins are not assigning weights to employees in P1.1; they are configuring the menu of allowed whole-percentage choices that later employees or managers may select from when creating objective plans.

#### Scenario: Tenant Admin views current configuration

- **WHEN** a Tenant Admin opens Tenant Objective Planning Configuration
- **THEN** the system shows the current max objective count, allowed weight menu, and enabled measurement methods for that tenant
- **AND** the system does not show campaign settings, employee objectives, manager approval, objective templates, template categories, manager-review SLA, strategic alignment, attachments, Draft, Publish, or Superseded controls.

#### Scenario: Missing tenant configuration is not created by GET

- **WHEN** a tenant-scoped user views Tenant Objective Planning Configuration before provisioning exists
- **THEN** the system returns a recoverable not-configured state or provisioning-required error
- **AND** the read does not create or mutate tenant configuration.

### Requirement: Tenant configuration validation

The system SHALL validate tenant configuration edits against platform limits and objective-planning feasibility during Apply.

#### Scenario: Tenant values outside platform limits are rejected

- **WHEN** a Tenant Admin applies a configuration whose max objective count, allowed weight menu, or enabled measurement methods exceed Platform Performance Configuration limits
- **THEN** the system rejects Apply with validation errors
- **AND** the tenant configuration remains unchanged.

#### Scenario: Allowed weights must support a 100 percent plan

- **WHEN** a Tenant Admin applies an allowed weight menu
- **THEN** the system verifies that at least one combination of allowed weights can total exactly 100 percent within the maximum objective count
- **AND** Apply fails if no such combination exists.

#### Scenario: Tenant weight menu uses platform-approved business choices

- **WHEN** a Tenant Admin applies an allowed weight menu
- **THEN** each value must be a whole percentage selected from the platform-supported choices
- **AND** the menu should remain simple and reviewable rather than defaulting to every possible 5 percent value from 5 to 100
- **AND** the UI explains weights as objective importance choices for future plans.

#### Scenario: At least one measurement method is enabled

- **WHEN** a Tenant Admin applies measurement methods
- **THEN** the system requires at least one of Quantitative or Qualitative to be enabled
- **AND** Apply fails if an enabled method is not available in Platform Performance Configuration.

### Requirement: Tenant configuration apply

The system SHALL apply Tenant Objective Planning Configuration atomically after server-side validation.

#### Scenario: Valid tenant configuration applies atomically

- **WHEN** a Tenant Admin applies a valid configuration with the expected concurrency token
- **THEN** the system stores the new current configuration in one transaction
- **AND** the response reflects the applied values without requiring a refresh.

#### Scenario: Stale tenant apply is rejected

- **WHEN** a Tenant Admin submits Apply with a stale concurrency token
- **THEN** the system rejects the request as a conflict
- **AND** the tenant configuration remains unchanged.

#### Scenario: Failed apply preserves user work

- **WHEN** Apply fails because of validation, conflict, or permission denial
- **THEN** the frontend preserves the entered values for correction or retry
- **AND** the system does not show false success.

### Requirement: Tenant isolation and authorization

The system SHALL enforce tenant isolation and server-side authorization for all tenant objective-planning configuration reads, validation, and apply operations.

#### Scenario: Tenant user cannot access another tenant configuration

- **WHEN** a tenant-scoped user requests another tenant's objective-planning configuration
- **THEN** the system denies access server-side
- **AND** no cross-tenant configuration data is returned.

#### Scenario: User without manage permission cannot apply

- **WHEN** a tenant-scoped user without tenant configuration manage permission submits Apply
- **THEN** the system denies the request
- **AND** the tenant configuration remains unchanged.

### Requirement: New-tenant provisioning

The system SHALL explicitly and idempotently provision new tenant objective-planning configuration from the current platform starting configuration.

#### Scenario: New tenant is provisioned from current starting configuration

- **WHEN** tenant creation triggers Performance provisioning for a tenant with no existing objective-planning configuration
- **THEN** the system creates the tenant configuration from the current platform starting configuration
- **AND** the provisioned tenant configuration is independent from later platform starting-configuration changes.

#### Scenario: Provisioning retry is idempotent

- **WHEN** provisioning is retried for a tenant that already has objective-planning configuration
- **THEN** the system returns the existing configuration identity
- **AND** it creates no duplicate configuration.

#### Scenario: Provisioning fails when platform starting configuration is missing

- **WHEN** provisioning runs and no platform starting configuration has been applied
- **THEN** the system returns a clear provisioning failure
- **AND** no partial tenant configuration is created.

### Requirement: Tenant configuration audit facts

The system SHALL preserve essential actor, timestamp, and change facts for tenant objective-planning configuration changes without requiring a dedicated history product.

#### Scenario: Tenant apply records essential facts

- **WHEN** a Tenant Admin successfully applies configuration
- **THEN** the system records who applied the change, when it was applied, and the changed configuration facts
- **AND** the product UI does not expose version identifiers or a version history workflow.

