# performance-cascade-coverage Specification (delta)

## ADDED Requirements

### Requirement: A launched campaign exposes a read-only cascade coverage view

The system SHALL compute, for a launched campaign, a read-only cascade coverage view answering whether the campaign strategy is being translated into team objectives: total active strategic objectives, total team objectives, strategic objectives with and without linked team objectives, the campaign's managers (the distinct frozen approvers in the participant baseline) with and without team objectives, and each manager's team-objective count and scope size. The view SHALL be computed live from current data, reads SHALL NOT mutate state, and coverage SHALL NOT be persisted as a campaign state.

#### Scenario: Coverage reflects the cascade truthfully

- **GIVEN** a launched campaign with three active strategic objectives, where one manager created two team objectives linked to the same strategic objective and a second manager created none
- **WHEN** an authorized user opens cascade coverage
- **THEN** the view shows one strategic objective covered and two uncovered
- **AND** one manager with two team objectives and one manager with none

#### Scenario: Coverage updates without persisting state

- **WHEN** a manager saves a new team objective and coverage is opened again
- **THEN** the coverage reflects the new objective
- **AND** no coverage or readiness value was written to the campaign

#### Scenario: Coverage exists only for launched campaigns

- **WHEN** a user requests cascade coverage for a campaign still in Draft
- **THEN** the system rejects the request because the campaign is not launched for objective planning

### Requirement: Coverage gaps are informational, never blocking

The system SHALL present cascade coverage gaps (uncovered strategic objectives, managers without team objectives) as readiness information for follow-up. Coverage gaps SHALL NOT block any campaign operation, SHALL NOT create reminder or escalation workflows, and SHALL NOT be presented as blocker management.

#### Scenario: Gaps inform without blocking

- **WHEN** an authorized user views coverage for a campaign where some managers have no team objectives
- **THEN** the gaps are presented as informational readiness context in product language
- **AND** no campaign operation is disabled because of them
- **AND** no reminder or escalation action is offered

### Requirement: Coverage is reachable by HR and Direction through their own grants

The system SHALL grant read access to cascade coverage (including the campaign's strategic objectives and team objectives) to users holding the strategic-view permission or an HR campaign-view/management permission. Direction users with only the strategic-view permission SHALL be able to view coverage without any HR campaign or admin permission and SHALL NOT gain any mutation capability. Access SHALL be deny-by-default and tenant-scoped; cross-tenant requests SHALL answer as not found.

#### Scenario: Direction views coverage with strategic-view only

- **GIVEN** a signed-in user whose only relevant grant is the tenant-scoped strategic-view permission
- **WHEN** they open a launched campaign's cascade coverage
- **THEN** the strategy and coverage view is returned read-only
- **AND** no create, edit, delete, or campaign administration capability is exposed

#### Scenario: Unpermitted user is denied

- **WHEN** a signed-in user without strategic-view and without campaign-view/management permission requests cascade coverage
- **THEN** the system denies the request

#### Scenario: Cross-tenant coverage answers not found

- **WHEN** a user requests cascade coverage for a campaign of another tenant
- **THEN** the system responds as not found for the acting tenant
