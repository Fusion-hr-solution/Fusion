# performance-navigation Specification (delta)

## ADDED Requirements

### Requirement: Manager Team objectives workspace navigation

The system SHALL expose a `Team objectives` workspace in the Performance sidebar for users holding the team-objective management permission, navigating to `/performance/team-objectives`. The workspace SHALL list the launched campaigns where the signed-in user is a frozen approver, each opening that campaign's team-objectives workspace at `/performance/team-objectives/{slug}`. Managers SHALL NOT need the HR `Campaigns` workspace to do team-objective work, and the sidebar SHALL NOT show `Team objectives` to users without the permission.

#### Scenario: Manager sees the Team objectives door

- **GIVEN** a signed-in user with the team-objective management permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Team objectives` navigating to `/performance/team-objectives`
- **AND** a user without the permission does not see it

#### Scenario: Campaign team-objectives workspace route renders

- **WHEN** a permitted manager opens `/performance/team-objectives/{slug}` for a launched campaign in their scope
- **THEN** the page renders that campaign's team-objectives workspace: strategy to translate, their frozen campaign scope summary, and their team objectives

#### Scenario: Truthful empty state without frozen responsibility

- **GIVEN** a user with the team-objective management permission who is not a frozen approver in any launched campaign
- **WHEN** they open `/performance/team-objectives`
- **THEN** the page states in product language that no launched campaign currently names them as responsible for participants
- **AND** does not present an error or a blank surface

### Requirement: Direction Strategy entry navigation

The system SHALL expose a `Strategy` entry in the Performance sidebar for users holding the strategic-view permission, navigating to `/performance/strategy`, which lists launched campaigns and opens each campaign's strategy and cascade coverage view at `/performance/strategy/{slug}`. The entry SHALL NOT require HR campaign or admin permissions and SHALL NOT be shown without the strategic-view permission.

#### Scenario: Direction sees the Strategy door

- **GIVEN** a signed-in user with the tenant-scoped strategic-view permission and no HR campaign permissions
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Strategy` navigating to `/performance/strategy`
- **AND** opening a listed launched campaign renders its strategy and cascade coverage read-only

#### Scenario: No Strategy entry without the permission

- **GIVEN** a signed-in user without the strategic-view permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar does not show `Strategy`

### Requirement: HR campaign workspace exposes cascade coverage for launched campaigns

The system SHALL present the cascade coverage surface within the campaign detail workspace for launched campaigns, reachable by users with campaign-view or campaign-management permission, keeping the breadcrumb anchored to `Campaigns` → campaign name. A campaign still in Draft SHALL NOT present a cascade coverage surface.

#### Scenario: HR reaches coverage from the campaign detail

- **WHEN** an HR user with campaign-view permission opens a launched campaign's detail
- **THEN** the cascade coverage surface is reachable within that campaign workspace
- **AND** the breadcrumb shows `Campaigns` as ancestor and the campaign name as context

#### Scenario: Draft campaigns show no coverage surface

- **WHEN** a user opens the detail of a campaign still in setup
- **THEN** no cascade coverage surface is offered

### Requirement: New workspaces use the single terminology source

The system SHALL label the `Team objectives` and `Strategy` areas and all their surfaces from the app's single Performance terminology source, using product language for states (no backend status codes, no draft/published lifecycle wording for team objectives), and breadcrumbs for the new areas SHALL reflect workspace → campaign name.

#### Scenario: Breadcrumbs for the new areas

- **WHEN** a user opens `/performance/team-objectives/{slug}` or `/performance/strategy/{slug}`
- **THEN** the breadcrumb shows the workspace label (`Team objectives` or `Strategy`) as ancestor and the campaign name as the current context

#### Scenario: Product language only

- **WHEN** any team-objective or strategy surface renders
- **THEN** labels come from the shared terminology module
- **AND** no enum names, lifecycle codes, or draft/published wording for team objectives appear
