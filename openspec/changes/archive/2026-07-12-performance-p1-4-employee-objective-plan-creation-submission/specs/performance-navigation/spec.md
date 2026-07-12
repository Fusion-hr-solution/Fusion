## ADDED Requirements

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
