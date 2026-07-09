## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Navigation terminology stays product-oriented

The system SHALL use concise sidebar terminology and keep full product terminology inside the page content.

#### Scenario: Sidebar uses short scalable labels

- **WHEN** the Performance sidebar renders
- **THEN** it uses `Overview`, `Configuration`, `Objective Planning`, `Campaigns`, `Platform administration`, and `Performance configuration`
- **AND** it does not use `Reviews`, `Performance setup`, `Platform setup`, or `Objective planning configuration` as sidebar labels
