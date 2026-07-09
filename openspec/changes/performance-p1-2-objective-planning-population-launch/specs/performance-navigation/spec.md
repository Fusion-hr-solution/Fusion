## ADDED Requirements

### Requirement: Campaigns workspace reflects campaign lifecycle state

The system SHALL present a campaign's lifecycle state in the campaigns workspace using product language — a campaign in `Draft` status SHALL read as being in setup, and a campaign in `Launched` status SHALL read as launched — in both the campaigns list and the campaign detail. Users SHALL NOT be shown backend status codes or enum names.

#### Scenario: Launched campaign is visually distinct

- **WHEN** a user views the campaigns list containing a launched campaign
- **THEN** the campaign is shown with a launched state in product language
- **AND** a campaign still in setup is shown distinctly as in setup

#### Scenario: Launched campaign detail presents setup read-only

- **WHEN** a user opens the detail of a launched campaign
- **THEN** the campaign's identity, schedule, strategic objectives, and population are presented read-only
- **AND** no draft-only editing controls are offered

### Requirement: Campaign detail exposes population, readiness, and launch within the campaign workspace

The system SHALL present objective-planning population scope, launch readiness review, and launch as part of the campaign detail workspace, keeping the breadcrumb anchored to the campaign context, and SHALL use product-oriented terminology drawn from a single terminology source rather than implementation or lifecycle codes.

#### Scenario: Population, readiness, and launch are reachable from campaign detail

- **WHEN** an authorized user opens a Draft campaign's detail
- **THEN** the user can reach the population scope, the readiness review, and the launch action within the campaign workspace

#### Scenario: Breadcrumb stays anchored to the campaign

- **WHEN** a user navigates the population, readiness, or launch surfaces of a campaign
- **THEN** the breadcrumb reflects the campaigns workspace and the specific campaign
- **AND** does not expose route or lifecycle identifiers as labels
