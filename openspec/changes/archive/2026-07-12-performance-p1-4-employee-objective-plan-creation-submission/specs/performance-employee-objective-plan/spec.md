## ADDED Requirements

### Requirement: Included participant owns one objective plan per launched campaign

The system SHALL represent an employee objective plan as a single working package per included participant per launched campaign, owned by that participant, holding the participant's objectives, plan status, computed total weight, and (when submitted) a submission timestamp and frozen approver reference. The system SHALL create at most one plan per participant per campaign and SHALL NOT create competing plans. Plan access SHALL be resolved from the campaign's frozen P1.2 participant baseline (the employee's own participant record), NOT from live Core reporting lines.

#### Scenario: Included participant opens their plan

- **GIVEN** a launched campaign whose frozen participant baseline includes the signed-in employee
- **AND** employee objective entry is open per the campaign schedule
- **WHEN** the employee opens their campaign objective plan
- **THEN** the system returns the employee's own plan (creating an empty Draft plan on first open if none exists)
- **AND** the plan is associated with that campaign and the employee's frozen participant record

#### Scenario: Non-participant is denied a plan

- **GIVEN** a launched campaign whose frozen participant baseline does NOT include the signed-in employee
- **WHEN** the employee attempts to open a plan for that campaign
- **THEN** the system denies access
- **AND** does not create a plan

#### Scenario: Live reporting-line change does not alter plan ownership

- **GIVEN** an employee with a Draft or Submitted plan in a launched campaign
- **WHEN** Core later changes that employee's manager or org unit
- **THEN** the plan still belongs to the same frozen participant and frozen approver captured at launch

#### Scenario: A second plan is never created

- **GIVEN** an employee who already has a plan in a launched campaign
- **WHEN** the employee opens their plan again
- **THEN** the system returns the existing plan
- **AND** does not create a second plan for that campaign

### Requirement: Employee objective entry is gated by the campaign planning schedule

The system SHALL open employee objective authoring only on or after the campaign's planning opening date; campaign launch alone SHALL NOT open authoring. Before the opening date the employee MAY see the plan and campaign context read-only but SHALL NOT create, edit, delete, or submit objectives. The submission deadline SHALL be shown as context and SHALL NOT hard-block submission in this slice.

#### Scenario: Before opening date entry is closed

- **GIVEN** a launched campaign whose planning opening date is in the future
- **WHEN** an included employee opens their plan
- **THEN** the workspace communicates that objective planning is not open yet
- **AND** create, edit, delete, and submit are unavailable

#### Scenario: On or after opening date entry is open

- **GIVEN** a launched campaign whose planning opening date has passed
- **WHEN** an included employee opens their Draft plan
- **THEN** the employee can create, edit, delete, and submit objectives

#### Scenario: Past submission deadline does not block submission

- **GIVEN** a launched campaign whose employee submission deadline has passed but planning is not locked
- **WHEN** an included employee submits a valid plan
- **THEN** the system accepts the submission
- **AND** surfaces the deadline as context rather than blocking

#### Scenario: Server enforces schedule regardless of client

- **WHEN** a create, edit, delete, or submit request arrives for a campaign whose planning has not opened
- **THEN** the server rejects the write
- **AND** no objective or status change is persisted

### Requirement: Employee authors individual objectives while the plan is Draft

The system SHALL let the owning employee create, edit, and delete individual objectives while the plan is Draft. Draft saving SHALL be permitted with incomplete objectives and with a total weight other than 100%, so the employee can save progress. Each individual objective SHALL capture: title (required, ≤150 chars), description/context (optional, ≤500 chars), alignment target (required), weight, deadline, measurement method, and structured measurement detail. The system SHALL NOT let the number of objectives exceed the campaign's frozen maximum objective count.

#### Scenario: Employee saves an incomplete draft objective

- **GIVEN** a Draft plan with entry open
- **WHEN** the employee creates an objective with a title but not yet all submission fields
- **THEN** the system saves the objective in the Draft plan
- **AND** does not block the save for missing submission fields

#### Scenario: Employee edits and deletes draft objectives

- **WHEN** the owning employee edits or deletes an objective in their Draft plan
- **THEN** the change is persisted
- **AND** reflected immediately in the workspace without a manual refresh

#### Scenario: Objective count cannot exceed the frozen maximum

- **GIVEN** a Draft plan already holding the campaign's frozen maximum number of objectives
- **WHEN** the employee attempts to add another objective
- **THEN** the system rejects the addition
- **AND** communicates the maximum in product language

#### Scenario: Title length is enforced

- **WHEN** the employee saves an objective whose title exceeds 150 characters
- **THEN** the system rejects the save with a validation message
- **AND** preserves the employee's entered values

### Requirement: Each objective aligns to the approver's team objective or directly to campaign strategy

The system SHALL require every individual objective to align to exactly one target: either a team objective authored by the participant's frozen approver in the same launched campaign, or an active campaign strategic objective (fallback). The system SHALL offer, for alignment, only team objectives owned by the employee's frozen approver and only active strategic objectives of the campaign. When an objective aligns to a team objective, its supported strategic objective SHALL be derivable through that team objective. Team objectives SHALL be presented without any draft/published lifecycle wording.

#### Scenario: Align to the approver's team objective

- **GIVEN** an employee whose frozen approver has authored team objectives in the campaign
- **WHEN** the employee opens the alignment picker for an objective
- **THEN** the picker offers those approver-owned team objectives
- **AND** does not offer team objectives owned by other managers

#### Scenario: Direct strategic alignment fallback

- **GIVEN** an employee whose approver has authored no suitable team objective
- **WHEN** the employee aligns an objective
- **THEN** the employee can align directly to an active campaign strategic objective

#### Scenario: Inactive strategic objective is not selectable

- **WHEN** the alignment picker renders for a new objective
- **THEN** inactive or unavailable strategic objectives are not offered as alignment targets

#### Scenario: Alignment is required for submission

- **WHEN** the employee submits a plan containing an objective with no alignment target
- **THEN** the system blocks submission
- **AND** identifies the unaligned objective

### Requirement: Objective measurement detail is structured by measurement method

The system SHALL require each objective's measurement method to be one of the campaign's frozen enabled methods, and SHALL capture measurement detail structured by that method: a Quantitative objective SHALL capture an indicator, a target value, and an optional unit; a Qualitative objective SHALL capture success criteria. Weight SHALL be one of the campaign's frozen allowed weight values, chosen from a bounded control — free-text weight entry SHALL NOT be allowed.

#### Scenario: Quantitative objective captures indicator, target, and unit

- **GIVEN** a campaign whose frozen rules enable the Quantitative method
- **WHEN** the employee sets an objective's method to Quantitative
- **THEN** the form requires an indicator and a target value and accepts an optional unit

#### Scenario: Qualitative objective captures success criteria

- **GIVEN** a campaign whose frozen rules enable the Qualitative method
- **WHEN** the employee sets an objective's method to Qualitative
- **THEN** the form requires success criteria

#### Scenario: Disabled measurement method is rejected

- **WHEN** a save or submit request carries a measurement method not enabled by the campaign's frozen rules
- **THEN** the system rejects it as invalid

#### Scenario: Weight is chosen from the frozen allowed values

- **WHEN** the employee sets an objective's weight
- **THEN** only the campaign's frozen allowed weight values are selectable
- **AND** a weight outside that set is rejected on save

### Requirement: Submission enforces the frozen planning rules strictly

The system SHALL transition a plan from Draft to Submitted only when it passes every blocking rule evaluated against the campaign's frozen planning-rules snapshot: total objective weight equals exactly 100%, every objective has all required fields (title, alignment target, weight, deadline, measurement method, and method-appropriate measurement detail), objective count does not exceed the frozen maximum, every weight is a frozen allowed value, and every measurement method is a frozen enabled method. If any rule fails, the plan SHALL remain Draft, the employee SHALL see the specific reasons, and previously entered values SHALL be preserved. The system SHALL surface the live total weight and objective count while the employee works.

#### Scenario: Valid plan submits

- **GIVEN** a Draft plan whose objectives total exactly 100% and satisfy all required fields and frozen rules
- **WHEN** the employee submits
- **THEN** the plan becomes Submitted
- **AND** a submission timestamp is recorded

#### Scenario: Weight total not 100% blocks submission

- **GIVEN** a Draft plan whose objective weights total 80%
- **WHEN** the employee attempts to submit
- **THEN** the system blocks submission
- **AND** communicates the current total and the remaining amount

#### Scenario: Missing required field blocks submission

- **GIVEN** a Draft plan where one objective is missing its measurement detail
- **WHEN** the employee attempts to submit
- **THEN** the system blocks submission
- **AND** identifies which objective and field are incomplete
- **AND** preserves all entered values

#### Scenario: Server re-validates on submit

- **WHEN** a submit request arrives
- **THEN** the server re-evaluates every blocking rule against the frozen snapshot before transitioning
- **AND** rejects the transition if any rule fails

### Requirement: Submitted plans are read-only and handed off for manager review

The system SHALL make a Submitted plan read-only to the owning employee in this slice: the employee SHALL NOT edit, add, delete objectives, resubmit, or withdraw a submitted plan. The system SHALL preserve the submitted plan with its submission timestamp and the frozen approver reference so that P1.5 manager review can list it. This slice SHALL NOT implement approval, request-changes, resubmission, or withdraw.

#### Scenario: Submitted plan cannot be edited by the employee

- **GIVEN** a Submitted plan owned by the employee
- **WHEN** the employee attempts to add, edit, or delete an objective, or resubmit
- **THEN** the system denies the operation
- **AND** presents the plan read-only awaiting manager review

#### Scenario: Submission preserves the review handoff

- **WHEN** a plan becomes Submitted
- **THEN** the plan retains its status, submission timestamp, and the frozen approver reference from the P1.2 baseline
- **AND** the submitted plan is discoverable for the frozen approver's later review

#### Scenario: No withdraw path exists in this slice

- **WHEN** the employee views a Submitted plan
- **THEN** no self-withdraw or un-submit action is offered

### Requirement: Employee plan operations are tenant-isolated and authorized deny-by-default

The system SHALL deny employee objective plan operations by default. Authoring SHALL require the employee self-manage permission (`performance.objective.self.manage`, `Self` scope) and SHALL be limited to the acting employee's own plan for a campaign in which they are an included frozen participant. An employee SHALL NOT read or mutate another employee's plan. HR, managers-as-approvers, and Direction SHALL NOT author or edit an employee's plan in this slice. All operations SHALL be scoped to the acting tenant; cross-tenant targets SHALL answer as not found.

#### Scenario: Employee cannot access another employee's plan

- **WHEN** an employee attempts to read or mutate a plan owned by a different employee
- **THEN** the system denies the operation and changes nothing

#### Scenario: Self permission is required

- **GIVEN** an employee-linked account lacking the self-manage permission
- **WHEN** the account attempts to author an objective plan
- **THEN** the system denies the operation

#### Scenario: Manager-as-approver cannot author the employee's plan

- **WHEN** the frozen approver attempts to create or edit objectives inside a participant's own plan
- **THEN** the system denies it in this slice

#### Scenario: Cross-tenant plan access answers not found

- **WHEN** a user attempts to read or mutate a plan or objective belonging to another tenant's campaign
- **THEN** the system responds as not found for the acting tenant and mutates nothing

### Requirement: Employee planning actions are audited

The system SHALL record an audit fact for meaningful employee planning actions — plan first opened/created, objective created, objective updated, objective deleted, and plan submitted — capturing the acting user, tenant, campaign, participant/employee, plan, objective (where applicable), timestamp, and meaningful changed fields, reusing the existing Performance audit mechanism.

#### Scenario: Objective changes and submission write audit facts

- **WHEN** an employee creates, updates, or deletes an objective, or submits the plan
- **THEN** the system records an audit fact identifying the actor, tenant, campaign, employee, plan, the objective where applicable, and what changed

### Requirement: The My objectives workspace resolves to one truthful state

The system SHALL render the employee "My objectives" workspace from the app's single Performance terminology source, always resolving to one truthful state: the open Draft plan, an entry-not-open notice, a read-only Submitted plan, a truthful empty state when the employee is in no launched campaign, a recoverable error, or permission-denied. Reads SHALL NOT mutate state. A manager who is also a participant SHALL author their personal plan through this employee workspace, kept clearly separate from the manager "Team objectives" workspace. Product language SHALL be used — no backend status codes or lifecycle enum names.

#### Scenario: Truthful empty state when not in any campaign

- **GIVEN** an employee who is not an included participant in any launched campaign
- **WHEN** they open `My objectives`
- **THEN** the page states in product language that they have no campaign objective plan to work on
- **AND** does not present an error or a blank surface

#### Scenario: Manager-as-employee stays separate

- **GIVEN** a manager who is also an included participant in the campaign
- **WHEN** they open `My objectives`
- **THEN** they see their personal objective plan workspace
- **AND** it is distinct from their `Team objectives` workspace

#### Scenario: Opening the plan does not write

- **WHEN** the employee opens an existing plan
- **THEN** no objective content or status is mutated by the read
