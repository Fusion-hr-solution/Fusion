## ADDED Requirements

### Requirement: Platform configuration dimensions

The system SHALL let Platform Admins manage only the platform-supported objective-planning dimensions for tenants: maximum objective count, allowed objective weights, and Quantitative/Qualitative measurement availability.

Objective weights SHALL be whole percentages that represent relative business importance inside a future employee objective plan. P1.1 SHALL support clean percentage weighting only, with 5% increments as the professional standard. The recommended platform starter menu SHALL be `5, 10, 15, 20, 25, 30, 40, 50`, rather than every possible 5% value or arbitrary values such as 17%, 23%, or 37%.

#### Scenario: Platform Admin views supported dimensions

- **WHEN** a Platform Admin opens Platform Performance Configuration
- **THEN** the system shows the current maximum objective count limit
- **AND** the system shows the platform-supported allowed objective weights as whole-percentage choices
- **AND** the system shows whether Quantitative and Qualitative measurement methods are available
- **AND** the system does not show template limits, manager-review SLA, campaign settings, strategic-alignment settings, attachments, Draft, Publish, or Superseded controls.

#### Scenario: Non-platform user is denied

- **WHEN** a user without Platform Admin authority requests Platform Performance Configuration
- **THEN** the system denies access server-side
- **AND** no platform configuration data is returned.

### Requirement: Platform starting configuration

The system SHALL maintain a starting objective-planning configuration used only when newly created tenants are explicitly provisioned.

#### Scenario: Platform Admin views starting configuration

- **WHEN** a Platform Admin views the starting configuration
- **THEN** the system shows the max objective count, allowed weights, and enabled measurement methods that will be copied for future tenant provisioning
- **AND** the system distinguishes the starting configuration from existing tenant configurations.

#### Scenario: Platform change does not mutate existing tenants

- **WHEN** a Platform Admin applies a new starting configuration
- **THEN** existing tenant objective-planning configurations remain unchanged
- **AND** future tenant provisioning uses the newly applied starting configuration.

### Requirement: Platform configuration validation and impact

The system SHALL validate platform configuration edits during Apply and SHALL report blocking impact without partially applying changes.

#### Scenario: Invalid platform configuration is rejected

- **WHEN** a Platform Admin applies a platform configuration where allowed weights cannot total 100 percent within the starting maximum objective count
- **THEN** the system rejects Apply with validation errors
- **AND** the current platform configuration remains unchanged.

#### Scenario: Platform weights must stay clean and feasible

- **WHEN** a Platform Admin applies platform weight limits or a starting weight menu
- **THEN** the system rejects arbitrary decimal precision, free-text values, duplicate values, and uncurated values outside the supported whole-percent increment standard
- **AND** the system rejects a setup that cannot produce at least one objective plan totaling exactly 100 percent within the starting maximum objective count
- **AND** the system does not require the default menu to include values above 50 percent.

#### Scenario: Existing tenant impact blocks apply

- **WHEN** a Platform Admin applies tighter platform limits that would make existing tenant configurations outside supported limits
- **THEN** the system returns the blocking impact
- **AND** the current platform configuration remains unchanged
- **AND** no tenant configuration is mutated.

#### Scenario: Valid platform configuration applies atomically

- **WHEN** a Platform Admin applies a valid platform configuration with the expected concurrency token
- **THEN** the system atomically stores the new supported limits and starting configuration
- **AND** the response reflects the applied configuration without requiring a refresh.

### Requirement: Platform configuration concurrency and audit facts

The system SHALL use optimistic concurrency for Platform Performance Configuration Apply and SHALL preserve essential actor, timestamp, and change facts.

#### Scenario: Stale platform apply is rejected

- **WHEN** a Platform Admin submits Apply with a stale concurrency token
- **THEN** the system rejects the request as a conflict
- **AND** the current platform configuration remains unchanged.

#### Scenario: Platform apply records essential facts

- **WHEN** a Platform Admin successfully applies platform configuration
- **THEN** the system records who applied the change, when it was applied, and the changed configuration facts
- **AND** the product UI is not required to expose a dedicated history browser.

### Requirement: Platform reads do not write

The system SHALL NOT initialize, provision, repair, or mutate platform or tenant configuration from a read operation.

#### Scenario: Platform GET is side-effect free

- **WHEN** a Platform Admin views Platform Performance Configuration
- **THEN** the system reads the current state only
- **AND** it does not create platform defaults, tenant configuration, audit entries, or provisioning records.
