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

### Requirement: Employee My objectives workspace navigation

The system SHALL expose a `My objectives` workspace in the Performance sidebar for employee-linked accounts holding the self-manage objective permission (`performance.objective.self.manage`, `Self` scope), navigating to `/performance/my-objectives`. The workspace SHALL list the launched campaigns where the signed-in user is an included frozen participant, each opening that campaign's personal objective plan at `/performance/my-objectives/{slug}`. The sidebar SHALL NOT show `My objectives` to accounts without an employee link or without the permission, and the door SHALL remain visually and behaviourally distinct from the manager `Team objectives` door. Breadcrumbs for this area SHALL reflect `My objectives` → campaign name.

#### Scenario: Employee sees the My objectives door

- **GIVEN** a signed-in employee-linked account holding the self-manage objective permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `My objectives` navigating to `/performance/my-objectives`
- **AND** an account without an employee link or without the permission does not see it

#### Scenario: Campaign plan route renders the personal workspace

- **WHEN** an included participant opens `/performance/my-objectives/{slug}` for a launched campaign
- **THEN** the page renders that campaign's personal objective plan workspace: campaign and schedule context, alignment options, the objective list, weight total and count, and the plan state

#### Scenario: Truthful empty state without any campaign

- **GIVEN** an employee-linked account with the permission who is not an included participant in any launched campaign
- **WHEN** they open `/performance/my-objectives`
- **THEN** the page states in product language that they have no campaign objective plan to work on
- **AND** does not present an error or a blank surface

#### Scenario: My objectives is separate from Team objectives

- **GIVEN** a manager who is also an included participant
- **WHEN** the sidebar renders
- **THEN** both `My objectives` and `Team objectives` appear as distinct doors
- **AND** each navigates to its own workspace

#### Scenario: Breadcrumb reflects workspace then campaign

- **WHEN** a user opens `/performance/my-objectives/{slug}`
- **THEN** the breadcrumb shows `My objectives` as ancestor and the campaign name as the current context

