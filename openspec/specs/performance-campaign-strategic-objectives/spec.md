# performance-campaign-strategic-objectives Specification

## Purpose
TBD - created by archiving change performance-p1-1-campaign-draft-foundation. Update Purpose after archive.
## Requirements
### Requirement: HR manages campaign-scoped strategic objectives within a Draft

The system SHALL let an authorized HR user create strategic objectives that belong to a specific campaign Draft, each with a required title, an optional description, and an optional responsible-function label. Campaign strategic objectives SHALL be scoped to their campaign and SHALL NOT be modeled as a generic, cross-campaign enterprise strategy record.

#### Scenario: Add a strategic objective to a Draft

- **WHEN** an authorized HR user adds a strategic objective with a title (and optional description/responsible function) to a campaign Draft
- **THEN** the system creates the objective attached to that campaign
- **AND** marks it active by default
- **AND** returns the updated objective list without requiring a manual refresh

#### Scenario: Title is required

- **WHEN** an authorized HR user submits a strategic objective without a title
- **THEN** the system rejects the creation with a validation reason naming the title
- **AND** does not create the objective
- **AND** preserves the other entered values

#### Scenario: Title and description respect length limits

- **WHEN** an authorized HR user submits a title or description exceeding the allowed length
- **THEN** the system rejects the change with a validation reason identifying the field

### Requirement: HR edits and toggles strategic objectives within a Draft

The system SHALL let an authorized HR user edit a campaign strategic objective's title, description, and responsible function, and toggle it active or inactive within the Draft.

#### Scenario: Edit an existing objective

- **WHEN** an authorized HR user updates the title, description, or responsible function of a campaign strategic objective
- **THEN** the system stores the changes on that objective

#### Scenario: Toggle active state

- **WHEN** an authorized HR user marks a strategic objective inactive (or active) within the Draft
- **THEN** the system records the new active state
- **AND** an inactive objective does not count toward the Draft's active-objective completeness requirement

### Requirement: Strategic-objective management is campaign-bound, tenant-isolated, and authorized

The system SHALL require a valid campaign in the acting tenant for every strategic-objective operation, SHALL reject operations targeting a campaign in another tenant, and SHALL require the same tenant-scoped campaign-management permission used to edit the campaign Draft. Reads SHALL require campaign-view (or management) permission and SHALL be deny-by-default.

#### Scenario: Objective operation on another tenant's campaign is denied

- **WHEN** a user attempts to add or edit a strategic objective on a campaign that belongs to a different tenant
- **THEN** the system does not mutate any data and responds as not found for that tenant

#### Scenario: Unpermitted user cannot manage objectives

- **WHEN** a signed-in user without campaign-management permission attempts to add, edit, or toggle a strategic objective
- **THEN** the system denies the operation
- **AND** does not change any objective

#### Scenario: Objective must reference an existing campaign

- **WHEN** an authorized user attempts to add a strategic objective to a campaign that does not exist in the acting tenant
- **THEN** the system rejects the operation as not found
- **AND** does not create the objective

### Requirement: Strategic-objective changes are audited

The system SHALL record audit facts — acting user, timestamp, and changed facts — when a campaign strategic objective is added, edited, or has its active state toggled, reusing the existing Performance audit mechanism.

#### Scenario: Adding an objective is recorded

- **WHEN** an authorized HR user adds a campaign strategic objective
- **THEN** the system records an audit fact capturing the acting user, timestamp, and the objective's campaign and title

