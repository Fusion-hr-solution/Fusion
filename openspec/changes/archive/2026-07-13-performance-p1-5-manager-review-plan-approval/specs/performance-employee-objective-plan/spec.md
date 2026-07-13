## MODIFIED Requirements

### Requirement: Employee authors individual objectives while the plan is Draft

The system SHALL let the owning employee create, edit, and delete individual objectives while the plan is open for authoring — that is, while it is Draft OR Changes requested (returned by the manager for correction). Authoring SHALL NOT be permitted while the plan is Submitted (awaiting review) or Approved. Draft saving SHALL be permitted with incomplete objectives and with a total weight other than 100%, so the employee can save progress. Each individual objective SHALL capture: title (required, ≤150 chars), description/context (optional, ≤500 chars), alignment target (required), weight, deadline, measurement method, and structured measurement detail. The system SHALL NOT let the number of objectives exceed the campaign's frozen maximum objective count.

#### Scenario: Employee saves an incomplete draft objective

- **GIVEN** a Draft plan with entry open
- **WHEN** the employee creates an objective with a title but not yet all submission fields
- **THEN** the system saves the objective in the Draft plan
- **AND** does not block the save for missing submission fields

#### Scenario: Employee edits and deletes draft objectives

- **WHEN** the owning employee edits or deletes an objective in their Draft plan
- **THEN** the change is persisted
- **AND** reflected immediately in the workspace without a manual refresh

#### Scenario: Employee edits objectives after changes are requested

- **GIVEN** a plan the manager returned as Changes requested, with entry open
- **WHEN** the owning employee adds, edits, or deletes an objective
- **THEN** the change is persisted
- **AND** the plan remains Changes requested until the employee resubmits

#### Scenario: Objective count cannot exceed the frozen maximum

- **GIVEN** a Draft plan already holding the campaign's frozen maximum number of objectives
- **WHEN** the employee attempts to add another objective
- **THEN** the system rejects the addition
- **AND** communicates the maximum in product language

#### Scenario: Title length is enforced

- **WHEN** the employee saves an objective whose title exceeds 150 characters
- **THEN** the system rejects the save with a validation message
- **AND** preserves the employee's entered values

### Requirement: Submitted plans are read-only and handed off for manager review

The system SHALL make a Submitted plan read-only to the owning employee while it awaits manager review: the employee SHALL NOT edit, add, or delete objectives, and SHALL NOT withdraw or un-submit it. The system SHALL preserve the submitted plan with its submission timestamp and the frozen approver reference so that the frozen approver can review it. When the manager requests changes, the plan SHALL become editable again for the owning employee (see the authoring requirement) and the employee SHALL be able to resubmit; resubmission SHALL re-evaluate every P1.4 blocking rule against the campaign's frozen planning-rules snapshot before returning the plan to Submitted, and SHALL record a resubmission timestamp and a review-history event. When the manager approves the plan, it SHALL become read-only to the employee as an approved planning baseline. There SHALL be no employee self-withdraw path in any state.

#### Scenario: Submitted plan cannot be edited by the employee

- **GIVEN** a Submitted plan owned by the employee awaiting review
- **WHEN** the employee attempts to add, edit, or delete an objective, or withdraw it
- **THEN** the system denies the operation
- **AND** presents the plan read-only awaiting manager review

#### Scenario: Submission preserves the review handoff

- **WHEN** a plan becomes Submitted
- **THEN** the plan retains its status, submission timestamp, and the frozen approver reference from the P1.2 baseline
- **AND** the submitted plan is discoverable for the frozen approver's review

#### Scenario: Resubmission revalidates the full plan

- **GIVEN** a plan in Changes requested that the employee has corrected
- **WHEN** the employee resubmits
- **THEN** the system re-evaluates every blocking rule against the frozen snapshot
- **AND** returns the plan to Submitted with a resubmission timestamp only if all rules pass, otherwise keeps it editable and reports the specific reasons

#### Scenario: Approved plan is read-only to the employee

- **GIVEN** a plan the manager has approved
- **WHEN** the employee opens it
- **THEN** the plan is presented read-only as an approved baseline with no edit, resubmit, or withdraw action

#### Scenario: No withdraw path exists in any state

- **WHEN** the employee views their plan in any status
- **THEN** no self-withdraw or un-submit action is offered

### Requirement: The My objectives workspace resolves to one truthful state

The system SHALL render the employee "My objectives" workspace from the app's single Performance terminology source, always resolving to one truthful state: the open Draft plan, an entry-not-open notice, a read-only Submitted plan awaiting review, a *Changes requested* plan that is editable and prominently shows the manager's change-request comment, a read-only *Approved* plan, a truthful empty state when the employee is in no launched campaign, a recoverable error, or permission-denied. Reads SHALL NOT mutate state. A manager who is also a participant SHALL author their personal plan through this employee workspace, kept clearly separate from the manager "Team objectives" and "Plan approvals" workspaces. Product language SHALL be used — no backend status codes or lifecycle enum names.

#### Scenario: Changes-requested plan shows the manager comment and reopens for editing

- **GIVEN** a plan the manager returned as Changes requested
- **WHEN** the employee opens My objectives for that campaign
- **THEN** the workspace shows the manager's change-request comment prominently
- **AND** the plan is editable and offers a resubmit action

#### Scenario: Approved plan is shown read-only

- **GIVEN** a plan the manager has approved
- **WHEN** the employee opens it
- **THEN** the workspace presents it read-only as approved in product language

#### Scenario: Truthful empty state when not in any campaign

- **GIVEN** an employee who is not an included participant in any launched campaign
- **WHEN** they open `My objectives`
- **THEN** the page states in product language that they have no campaign objective plan to work on
- **AND** does not present an error or a blank surface

#### Scenario: Manager-as-employee stays separate

- **GIVEN** a manager who is also an included participant in the campaign
- **WHEN** they open `My objectives`
- **THEN** they see their personal objective plan workspace
- **AND** it is distinct from their `Team objectives` and `Plan approvals` workspaces

#### Scenario: Opening the plan does not write

- **WHEN** the employee opens an existing plan
- **THEN** no objective content or status is mutated by the read
