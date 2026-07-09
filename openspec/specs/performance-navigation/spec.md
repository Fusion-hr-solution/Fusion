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
- **THEN** it uses `Overview`, `Configuration`, `Objective Planning`, `Campaigns`, `Platform administration`, and `Performance configuration`
- **AND** it does not use `Reviews`, `Performance setup`, `Platform setup`, or `Objective planning configuration` as sidebar labels

### Requirement: Campaigns workspace navigation

The system SHALL expose a permission-gated `Campaigns` workspace in the Performance sidebar for users with campaign-view or campaign-management permission, providing access to the campaign list, campaign creation, and the campaign Draft workspace.

#### Scenario: Permitted user sees Campaigns

- **GIVEN** a signed-in tenant user with campaign-view or campaign-management permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Campaigns`
- **AND** `Campaigns` navigates to `/performance/campaigns`

#### Scenario: Unpermitted user does not see Campaigns

- **GIVEN** a signed-in Performance user without campaign-view or campaign-management permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar does not show `Campaigns`

#### Scenario: Campaign routes render their surfaces

- **WHEN** a permitted user opens `/performance/campaigns`
- **THEN** the page renders the campaign list surface (with a truthful empty state when no campaigns exist)
- **AND** opening `/performance/campaigns/new` renders the campaign create surface
- **AND** opening a campaign at `/performance/campaigns/{id}` renders that campaign's Draft workspace

### Requirement: Campaign breadcrumbs reflect the workspace hierarchy

The system SHALL render breadcrumbs for the campaign area that reflect the `Campaigns` → campaign name (or `New campaign`) hierarchy.

#### Scenario: Draft workspace breadcrumb

- **WHEN** a permitted user opens a campaign Draft at `/performance/campaigns/{id}`
- **THEN** the breadcrumb shows `Campaigns` as an ancestor
- **AND** shows the campaign name as the current page

#### Scenario: Create breadcrumb

- **WHEN** a permitted user opens `/performance/campaigns/new`
- **THEN** the breadcrumb shows `Campaigns` as an ancestor
- **AND** shows `New campaign` as the current page

