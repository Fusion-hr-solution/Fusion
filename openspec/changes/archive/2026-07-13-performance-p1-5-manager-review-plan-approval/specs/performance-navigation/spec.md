## ADDED Requirements

### Requirement: Manager Plan approvals workspace navigation

The system SHALL expose a `Plan approvals` workspace in the Performance sidebar for employee-linked accounts holding the plan-approval permission (`performance.objective.team.approve`), navigating to `/performance/plan-approvals`. The workspace SHALL list the launched campaigns where the signed-in user is a frozen approver of at least one participant, each opening that campaign's approvals workspace at `/performance/plan-approvals/{slug}`. The sidebar SHALL NOT show `Plan approvals` to accounts without an employee link or without the permission, and the door SHALL be a distinct top-level entry, separate from `Team objectives` and `My objectives`. Breadcrumbs for this area SHALL reflect `Plan approvals` → campaign name.

#### Scenario: Manager sees the Plan approvals door

- **GIVEN** a signed-in employee-linked account holding the plan-approval permission
- **WHEN** the Performance sidebar renders
- **THEN** the sidebar shows `Plan approvals` navigating to `/performance/plan-approvals`
- **AND** an account without an employee link or without the permission does not see it

#### Scenario: Plan approvals is separate from Team objectives and My objectives

- **GIVEN** a manager who is also an included participant holding team-objective, self-manage, and approval permissions
- **WHEN** the sidebar renders
- **THEN** `My objectives`, `Team objectives`, and `Plan approvals` appear as three distinct doors
- **AND** each navigates to its own workspace

#### Scenario: Campaign approvals workspace route renders

- **WHEN** a permitted manager opens `/performance/plan-approvals/{slug}` for a launched campaign in their scope
- **THEN** the page renders that campaign's approvals workspace: the assigned plans grouped by review state and the plan-review detail

#### Scenario: Truthful empty state without frozen approver scope

- **GIVEN** an account with the plan-approval permission who is not a frozen approver in any launched campaign
- **WHEN** they open `/performance/plan-approvals`
- **THEN** the page states in product language that no launched campaign currently assigns them plans to review
- **AND** does not present an error or a blank surface

#### Scenario: Breadcrumb reflects workspace then campaign

- **WHEN** a user opens `/performance/plan-approvals/{slug}`
- **THEN** the breadcrumb shows `Plan approvals` as ancestor and the campaign name as the current context
