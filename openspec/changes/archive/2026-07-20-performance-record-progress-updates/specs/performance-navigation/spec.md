# performance-navigation Delta

## MODIFIED Requirements

### Requirement: Employee My objectives workspace navigation

The system SHALL expose a `My objectives` workspace in the Performance sidebar for employee-linked accounts holding the self-manage objective permission (`performance.objective.self.manage`, `Self` scope), navigating to `/performance/my-objectives`. The workspace SHALL list the launched campaigns where the signed-in user is an included frozen participant, each opening that campaign's personal objective workspace at `/performance/my-objectives/{slug}`. Before planning lock, the campaign route SHALL render the personal objective plan workspace; once the campaign's planning is locked and the plan is Approved, the same route SHALL render the personal objective progress workspace on the locked baseline — the workspace evolves, no separate progress door is added. The sidebar SHALL NOT show `My objectives` to accounts without an employee link or without the permission, and the door SHALL remain visually and behaviourally distinct from the manager `Team objectives` door. Breadcrumbs for this area SHALL reflect `My objectives` → campaign name.

#### Scenario: Employee sees the My objectives door

- **GIVEN** a signed-in employee-linked account holding the self-manage objective permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `My objectives` navigating to `/performance/my-objectives`
- **AND** an account without an employee link or without the permission does not see it

#### Scenario: Campaign plan route renders the personal workspace

- **WHEN** an included participant opens `/performance/my-objectives/{slug}` for a launched campaign before planning lock
- **THEN** the page renders that campaign's personal objective plan workspace: campaign and schedule context, alignment options, the objective list, weight total and count, and the plan state

#### Scenario: Locked campaign route renders the progress workspace

- **GIVEN** a launched campaign whose planning is locked and the participant's plan is Approved
- **WHEN** the participant opens `/performance/my-objectives/{slug}`
- **THEN** the page renders the personal objective progress workspace on the locked baseline
- **AND** the route and breadcrumb are unchanged from the planning phase

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

## ADDED Requirements

### Requirement: Manager Team progress workspace navigation

The system SHALL expose a `Team progress` workspace in the Performance sidebar for employee-linked accounts holding the team-progress view permission (`performance.objective.progress.team.view`), navigating to `/performance/team-progress`. The workspace SHALL list the locked launched campaigns where the signed-in account is the current effective reviewer of at least one non-excluded participant, each opening the campaign team progress workspace at `/performance/team-progress/{slug}`. The sidebar SHALL NOT show `Team progress` to accounts without an employee link or without the permission; when a permitted reviewer has no reviewed participant, the workspace SHALL render a truthful empty state rather than an error (operational scope is enforced server-side). `Team progress` SHALL be a distinct top-level door, separate from `Plan approvals`, `Team objectives`, and `My objectives`. Breadcrumbs SHALL reflect `Team progress` → campaign name.

#### Scenario: Permitted reviewer sees the Team progress door

- **GIVEN** a signed-in employee-linked account holding the team-progress permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Team progress` navigating to `/performance/team-progress`
- **AND** an account without an employee link or without the permission does not see it

#### Scenario: Empty operational scope shows a truthful empty state

- **GIVEN** a permitted reviewer who reviews no participant in any locked campaign
- **WHEN** they open `/performance/team-progress`
- **THEN** the page states in product language that no locked campaign currently assigns them participants to follow
- **AND** does not present an error or another reviewer's data

#### Scenario: Team progress stands apart from the other manager doors

- **GIVEN** a manager holding self-manage, team-objective, approval, and team-progress permissions
- **WHEN** the sidebar renders
- **THEN** `My objectives`, `Team objectives`, `Plan approvals`, and `Team progress` appear as distinct doors each navigating to its own workspace

#### Scenario: Campaign team progress route renders

- **WHEN** a permitted effective reviewer opens `/performance/team-progress/{slug}` for a locked campaign in their scope
- **THEN** the page renders that campaign's team progress workspace ordered attention-first

#### Scenario: Breadcrumb reflects workspace then campaign

- **WHEN** a user opens `/performance/team-progress/{slug}`
- **THEN** the breadcrumb shows `Team progress` as ancestor and the campaign name as the current context
