# performance-team-objectives Specification

## Purpose
TBD - created by syncing change performance-p1-3-campaign-strategy-cascade-team-objectives. Update Purpose after archive.
## Requirements
### Requirement: Manager campaign scope derives from the frozen approver baseline

The system SHALL define a manager's campaign scope as the launched campaign's frozen participants whose resolved approver is the signed-in user's linked employee. Scope resolution SHALL use only the frozen P1.2 participant baseline and SHALL NOT re-resolve responsibility from live Core reporting lines. A signed-in user with no linked employee identity SHALL have no manager scope in any campaign.

#### Scenario: Scope lists the participants the manager is frozen approver for

- **WHEN** a manager with team-objective permission opens a launched campaign where they are the frozen approver of at least one participant
- **THEN** the system returns their campaign scope: the frozen participants for whom they are the resolved approver, with a business summary (participant count, participant preview, org units represented, campaign schedule context)

#### Scenario: Later Core reporting changes do not move scope

- **GIVEN** a launched campaign whose frozen baseline names the manager as approver of a participant
- **WHEN** Core later changes that participant's primary manager
- **THEN** the manager's campaign scope for that launched campaign is unchanged

#### Scenario: User without a linked employee identity has no scope

- **WHEN** a signed-in user whose account has no linked employee identity requests their team-objective campaigns
- **THEN** the system returns no campaigns and does not error

### Requirement: Managers see their team-objective campaigns

The system SHALL let a user with team-objective management permission list the launched campaigns in their tenant where they are the frozen approver of at least one participant, including each campaign's name, schedule context, and their own team-objective count. Campaigns still in Draft SHALL NOT appear.

#### Scenario: Only launched campaigns with frozen responsibility are listed

- **GIVEN** a tenant with one Draft campaign and two launched campaigns, only one of which freezes the user as an approver
- **WHEN** the user lists their team-objective campaigns
- **THEN** exactly the one launched campaign where they are a frozen approver is returned

#### Scenario: Read-only campaign strategy is visible to the manager

- **WHEN** a manager opens their team-objectives workspace for a launched campaign in their scope
- **THEN** the campaign's active strategic objectives are shown read-only
- **AND** no strategy editing affordance is offered

### Requirement: Manager creates a team objective linked to campaign strategy

The system SHALL let a manager with team-objective management permission create a team objective in a launched campaign where they are the frozen approver of at least one participant. A team objective SHALL require a title, a linked strategic objective that belongs to the same campaign and is active, a success criteria/target, and a measurement method that is one of the campaign's frozen planning-rules enabled measurement methods; description is optional. The owning manager SHALL be derived from the creating user and SHALL be immutable. Team objectives SHALL carry no weight and no lifecycle status: a saved team objective is part of the campaign cascade, and its availability to employees is governed solely by the campaign schedule.

#### Scenario: Create with valid content

- **WHEN** a manager in scope creates a team objective with a title, an active strategic objective of that campaign, success criteria, and an enabled measurement method
- **THEN** the system saves the team objective owned by that manager
- **AND** it appears immediately in the manager's team-objective list without a manual refresh
- **AND** no draft/published/approved status is stored or shown

#### Scenario: Required fields are enforced

- **WHEN** a manager submits a team objective missing the title, the strategic objective link, the success criteria, or the measurement method
- **THEN** the system rejects the creation with a validation reason naming the missing field
- **AND** preserves the other entered values

#### Scenario: Link must target an active strategic objective of the same campaign

- **WHEN** a manager attempts to link a team objective to an inactive strategic objective or to a strategic objective of a different campaign
- **THEN** the system rejects the operation with a validation reason
- **AND** does not create or change the team objective

#### Scenario: Measurement method must come from the frozen snapshot

- **WHEN** a manager submits a measurement method that is not in the campaign's frozen enabled measurement methods
- **THEN** the system rejects the operation with a validation reason identifying the measurement method

#### Scenario: Creation requires a launched campaign

- **WHEN** a user attempts to create a team objective on a campaign still in Draft
- **THEN** the system rejects the operation because the campaign is not launched for objective planning

### Requirement: Manager edits and deletes their own team objectives

The system SHALL let the owning manager edit their team objective's title, linked strategic objective (to another active strategic objective of the same campaign), success criteria, measurement method, and description, and delete their team objective, only while no employee objective aligns to it. A manager SHALL NOT edit or delete another manager's team objectives. When one or more employee objectives align to a team objective, deletion SHALL be blocked with a truthful reason rather than orphaning the aligned objectives; editing the team objective's content SHALL remain permitted. Concurrent edits SHALL be protected by optimistic concurrency.

#### Scenario: Owner edits succeed

- **WHEN** the owning manager updates their team objective with valid content
- **THEN** the system stores the changes
- **AND** the updated objective is reflected immediately in the workspace

#### Scenario: Owner deletes an unreferenced team objective

- **WHEN** the owning manager deletes their team objective and no employee objective aligns to it
- **THEN** the system removes it from the campaign cascade
- **AND** records the deletion in the audit trail

#### Scenario: Deletion is blocked when employee objectives align to it

- **GIVEN** a team objective that one or more employee objectives align to
- **WHEN** the owning manager attempts to delete it
- **THEN** the system blocks the deletion with a truthful reason
- **AND** the team objective and the aligned employee objectives are unchanged

#### Scenario: Non-owner cannot mutate

- **WHEN** a manager attempts to edit or delete a team objective owned by a different manager
- **THEN** the system denies the operation
- **AND** does not change the objective

#### Scenario: Stale concurrent edit is rejected

- **GIVEN** two sessions loaded the same team objective version
- **WHEN** the second session submits an edit after the first already saved
- **THEN** the system rejects the stale write with a conflict outcome
- **AND** the user's entered values are preserved for retry

### Requirement: Team-objective operations are tenant-isolated and authorized deny-by-default

The system SHALL deny team-objective operations by default. Authoring SHALL require the team-objective management permission and frozen-approver responsibility in the target campaign; users with HR campaign permissions but no frozen responsibility SHALL NOT author team objectives. HR users with campaign-view (or management) permission SHALL be able to read all team objectives of a campaign, read-only. All operations SHALL be scoped to the acting tenant; cross-tenant targets SHALL answer as not found.

#### Scenario: Permission without frozen responsibility cannot author

- **WHEN** a user holding the team-objective management permission but who is not a frozen approver of any participant in the campaign attempts to create a team objective there
- **THEN** the system denies the operation

#### Scenario: HR reads all, writes none

- **WHEN** an HR user with campaign-view permission opens a launched campaign's team objectives
- **THEN** all managers' team objectives are returned read-only
- **AND** create, edit, and delete are denied for that user in this slice

#### Scenario: Cross-tenant access answers not found

- **WHEN** a user attempts to read or mutate a team objective belonging to another tenant's campaign
- **THEN** the system responds as not found for the acting tenant and mutates nothing

### Requirement: Team-objective changes are audited

The system SHALL record an audit fact for every team-objective creation, update, and deletion, capturing the acting user, tenant, campaign, team objective, timestamp, and meaningful changed fields, reusing the existing Performance audit mechanism.

#### Scenario: Create, update, and delete each write an audit fact

- **WHEN** a manager creates, updates, or deletes a team objective
- **THEN** the system records an audit fact identifying the actor, tenant, campaign, the team objective, and what changed

### Requirement: The workspace communicates schedule-gated availability quietly

The system SHALL present saved team objectives as part of the campaign cascade and SHALL communicate — as quiet contextual information, not a status label on objectives — that employees can use them once the campaign schedule opens employee objective entry. The workspace SHALL NOT expose draft/published/ready/approved wording for team objectives.

#### Scenario: Before the planning opening date

- **WHEN** a manager views their saved team objectives before the campaign's employee planning opening date
- **THEN** the workspace indicates that these objectives become available to employees when planning opens on the scheduled date
- **AND** the objectives themselves carry no lifecycle labels
