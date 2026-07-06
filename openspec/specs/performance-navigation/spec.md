# performance-navigation Specification

## Purpose
TBD - created by archiving change performance-sidebar-navigation-alignment. Update Purpose after archive.
## Requirements
### Requirement: Role-aware Performance sidebar workspaces

The system SHALL render Performance sidebar destinations as stable role-aware workspaces rather than implementation partition names.

#### Scenario: Basic Performance user sees only overview

- **GIVEN** a signed-in Performance user without tenant configuration permission and without Platform Admin role
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Overview`
- **AND** it does not show `Configuration`
- **AND** it does not show `Platform administration`.

#### Scenario: Tenant configuration user sees objective planning

- **GIVEN** a signed-in tenant user with tenant-scoped objective-planning configuration permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Configuration`
- **AND** the section contains `Objective Planning`
- **AND** `Objective Planning` navigates to `/performance/configuration/planning`.

#### Scenario: Platform Admin sees platform administration

- **GIVEN** a signed-in Platform Admin
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Platform administration`
- **AND** the section contains `Performance configuration`
- **AND** `Performance configuration` navigates to `/performance/configuration/performance`.

#### Scenario: Platform Admin does not receive tenant configuration by role alone

- **GIVEN** a signed-in Platform Admin without tenant-scoped objective-planning configuration permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar does not show `Objective Planning`.

### Requirement: Canonical configuration routes

The system SHALL use scalable canonical routes for Performance configuration pages while preserving precise page titles.

#### Scenario: Tenant planning rules route renders objective planning configuration

- **WHEN** a permitted tenant user opens `/performance/configuration/planning`
- **THEN** the page renders the `Objective planning configuration` product surface.

#### Scenario: Platform performance route renders platform configuration

- **WHEN** a Platform Admin opens `/performance/configuration/performance`
- **THEN** the page renders the `Platform performance configuration` product surface.

#### Scenario: Legacy planning route remains a compatibility shim

- **WHEN** a user opens `/performance/planning`
- **THEN** the app redirects to `/performance/configuration/planning`
- **AND** the sidebar does not expose the old route label.

### Requirement: Navigation terminology stays product-oriented

The system SHALL use concise sidebar terminology and keep full product terminology inside the page content.

#### Scenario: Sidebar uses short scalable labels

- **WHEN** the Performance sidebar renders
- **THEN** it uses `Overview`, `Configuration`, `Objective Planning`, `Platform administration`, and `Performance configuration`
- **AND** it does not use `Reviews`, `Performance setup`, `Platform setup`, or `Objective planning configuration` as sidebar labels.

