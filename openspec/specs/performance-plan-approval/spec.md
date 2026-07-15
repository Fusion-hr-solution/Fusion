# performance-plan-approval Specification

## Purpose
TBD - created by archiving change performance-p1-5-manager-review-plan-approval. Update Purpose after archive.
## Requirements
### Requirement: Manager reviews only plans assigned through the frozen approver baseline

The system SHALL let a manager review a submitted employee objective plan only when the signed-in manager is the frozen approver of that plan's participant in the launched campaign, as captured in the P1.2 participant baseline (`ApproverEmployeeId`). Review scope SHALL derive solely from that frozen baseline and SHALL NOT be recalculated from live Core reporting lines. A later Core reporting-line change SHALL NOT add or remove plans from a manager's queue. A manager SHALL NOT see or act on plans assigned to a different approver, and a signed-in account without a linked employee identity SHALL have empty review scope, not an error.

#### Scenario: Manager sees plans they are the frozen approver for

- **GIVEN** a launched campaign whose frozen baseline names the signed-in manager as the approver of one or more participants
- **WHEN** the manager opens their plan approvals workspace
- **THEN** the system lists those participants' plans and no plans assigned to another approver

#### Scenario: Live reporting-line change does not alter the queue

- **GIVEN** a submitted plan whose frozen approver is the signed-in manager
- **WHEN** Core later changes that employee's manager or org unit
- **THEN** the plan still appears in the same manager's queue based on the frozen baseline

#### Scenario: Account without an employee identity has empty scope

- **GIVEN** a signed-in account holding the approve permission but not linked to an employee record
- **WHEN** the account opens the plan approvals workspace
- **THEN** the system returns an empty scope and does not error

#### Scenario: Cross-tenant plan review answers not found

- **WHEN** a manager attempts to open or act on a plan belonging to another tenant's campaign
- **THEN** the system responds as not found for the acting tenant and mutates nothing

### Requirement: Plan approvals queue groups plans by review state

The system SHALL present the manager's assigned plans grouped by review-relevant state: *Waiting for review* (plans currently Submitted or resubmitted and awaiting manager action), *Changes requested* (plans the manager returned and awaiting employee correction/resubmission), and *Approved* (plans the manager has validated). Each queue entry SHALL identify the employee, campaign context, submission/resubmission timing, objective count, and total plan weight, using product language only — no backend status codes or enum names. Draft plans (never submitted) SHALL NOT appear in the queue.

#### Scenario: Submitted plans appear under Waiting for review

- **GIVEN** a participant whose plan is Submitted and assigned to the signed-in manager
- **WHEN** the manager opens the queue
- **THEN** the plan is listed under Waiting for review with the employee, objective count, and total weight

#### Scenario: Returned plans appear under Changes requested

- **GIVEN** a plan the manager returned with a change request that the employee has not yet resubmitted
- **WHEN** the manager opens the queue
- **THEN** the plan is listed under Changes requested

#### Scenario: Draft-only plans are not queued

- **GIVEN** an assigned participant who has a Draft plan that was never submitted
- **WHEN** the manager opens the queue
- **THEN** that plan is not shown in any review group

### Requirement: Manager reviews the full plan before deciding

The system SHALL present a read-only plan-review detail that shows the whole submitted plan the manager decides on: employee and campaign context, plan status, submission date, total weight and objective count, and for each objective its title, description, alignment target (team objective or campaign strategic objective), weight, deadline, measurement method, and measurement detail (indicator/target/unit or success criteria). The detail SHALL surface any prior manager change-request comment and the plan review history. The manager SHALL NOT edit the employee's objectives from this surface; the only decisions are approve or request changes.

#### Scenario: Review detail shows the whole plan

- **WHEN** a manager opens a submitted plan assigned to them
- **THEN** the detail shows employee and campaign context, total weight, objective count, and every objective's alignment, weight, deadline, and measurement detail

#### Scenario: Prior change-request comment is visible on re-review

- **GIVEN** a plan that was returned once and resubmitted
- **WHEN** the manager reviews the resubmitted plan
- **THEN** the previous change-request comment and the review history are visible

#### Scenario: Manager cannot edit objectives from the review detail

- **WHEN** a manager views a plan under review
- **THEN** no control to add, edit, or delete the employee's objectives is offered

### Requirement: Manager approves a submitted plan at the plan level

The system SHALL let the assigned frozen approver approve a plan only while it is Submitted. Approval SHALL be a single plan-level decision — never objective-by-objective. On approval the system SHALL set the plan status to Approved, record the approving manager and an approval timestamp, make the plan read-only to both employee and manager, and record the approval in review history and audit. An approved plan SHALL be terminal in this slice: the system SHALL NOT offer un-approve, reopen, or reversal of an approved plan. Approval SHALL be unavailable on Draft, Changes requested, or already-Approved plans. An optional approval note MAY be captured but SHALL NOT be required.

#### Scenario: Approving a submitted plan validates it

- **GIVEN** a Submitted plan assigned to the signed-in manager
- **WHEN** the manager approves the plan
- **THEN** the plan becomes Approved with the approving manager and timestamp recorded
- **AND** the plan becomes read-only and the approval is written to review history and audit

#### Scenario: Approval is a single plan-level action

- **WHEN** the manager approves
- **THEN** the whole plan is approved in one decision
- **AND** no objective-by-objective approval is offered

#### Scenario: Non-submitted plans cannot be approved

- **WHEN** a manager attempts to approve a plan that is Draft, Changes requested, or already Approved
- **THEN** the system rejects the action and changes nothing

#### Scenario: Approved plans cannot be reversed in this slice

- **WHEN** a manager views an Approved plan
- **THEN** no un-approve, reopen, or reversal action is offered

### Requirement: Manager requests changes with a required comment

The system SHALL let the assigned frozen approver request changes only while the plan is Submitted, and SHALL require a non-empty manager comment for the request. On a valid request the system SHALL set the plan status to Changes requested, reopen the plan for the owning employee's correction, record the comment in review history so the employee can read it, and audit the action. A request-changes submitted without a comment SHALL be rejected and SHALL NOT change plan status.

#### Scenario: Requesting changes with a comment returns the plan

- **GIVEN** a Submitted plan assigned to the signed-in manager
- **WHEN** the manager requests changes with a comment
- **THEN** the plan becomes Changes requested
- **AND** the comment is stored in review history and made visible to the employee
- **AND** the action is audited

#### Scenario: Change request without a comment is rejected

- **WHEN** a manager attempts to request changes with an empty comment
- **THEN** the system rejects the request
- **AND** the plan status is unchanged

#### Scenario: Changes cannot be requested on a non-submitted plan

- **WHEN** a manager attempts to request changes on a Draft, Changes requested, or Approved plan
- **THEN** the system rejects the action and changes nothing

### Requirement: Plan review history is preserved as a chronological log

The system SHALL keep an append-only review history for each plan capturing the meaningful review events — submission, change request, resubmission, and approval — each with the acting user, a timestamp, the decision, and a comment where applicable. The history SHALL be a simple chronological record, not a threaded discussion, and SHALL be readable by the plan's owning employee and its frozen approver. History entries SHALL NOT be edited or deleted.

#### Scenario: Review events are recorded in order

- **GIVEN** a plan that was submitted, returned with changes, resubmitted, and approved
- **WHEN** the review history is read
- **THEN** it lists those events in chronological order with actor, timestamp, decision, and the change-request comment

#### Scenario: History is visible to both employee and approver

- **WHEN** either the owning employee or the frozen approver opens the plan
- **THEN** they can read the plan's review history

### Requirement: Plan approval is authorized deny-by-default and tenant-isolated

The system SHALL deny plan approval operations by default. Approve and request-changes SHALL require the manager approval permission (`performance.objective.team.approve`) AND SHALL be limited to plans whose frozen approver is the acting employee; holding the permission alone SHALL NOT authorize acting on a plan the manager is not the frozen approver of. HR, Direction, and other managers SHALL NOT approve or request changes on a plan they are not the frozen approver of in this slice. All operations SHALL be scoped to the acting tenant; cross-tenant targets SHALL answer as not found. The approval permission SHALL be described in product terms as approving employee objective plans, with no "collective objective" wording.

#### Scenario: Permission plus frozen-approver assignment is required

- **GIVEN** a manager holding the approval permission who is NOT the frozen approver of a target plan
- **WHEN** the manager attempts to approve or request changes on that plan
- **THEN** the system denies the operation and changes nothing

#### Scenario: Missing approval permission denies review actions

- **GIVEN** an employee-linked account that is a frozen approver but lacks the approval permission
- **WHEN** the account attempts to approve or request changes
- **THEN** the system denies the operation

#### Scenario: HR and Direction cannot approve in this slice

- **WHEN** an HR or Direction account attempts to approve or request changes on an employee plan
- **THEN** the system denies it in this slice

### Requirement: Self-approval is prevented and flagged as a data issue

The system SHALL prevent a manager from approving or requesting changes on their own objective plan through the approvals queue. If the frozen approver baseline names an employee as their own approver, the system SHALL treat it as a data issue: the self-owned plan SHALL NOT be actionable in that manager's queue and SHALL be surfaced as a flagged condition rather than an approvable item.

#### Scenario: Manager cannot approve their own plan

- **GIVEN** a manager whose own participant plan is (incorrectly) assigned to themselves as frozen approver
- **WHEN** the manager opens the approvals queue
- **THEN** their own plan is not offered as an approvable item
- **AND** the condition is surfaced as a data issue rather than a normal review task

#### Scenario: Manager-as-employee still manages their own plan elsewhere

- **GIVEN** a manager who is also an included participant
- **WHEN** they want to work on their own objectives
- **THEN** they do so through the employee My objectives workspace, not the approvals queue

### Requirement: Campaign-specific reassignment controls effective plan reviewer

The system SHALL use P1.6 campaign-specific reviewer reassignment, when present, as the effective reviewer for pending manager approval actions. If no reassignment exists, the system SHALL continue to use the frozen P1.2 approver baseline. Reassignment SHALL NOT grant HR approval authority and SHALL NOT allow objective-by-objective approval.

#### Scenario: Reassigned reviewer can review submitted plan
- **GIVEN** a submitted plan whose participant was reassigned to a new campaign reviewer in P1.6
- **WHEN** the new reviewer opens Plan approvals
- **THEN** the plan appears in the new reviewer's queue
- **AND** the reviewer can approve the whole plan or request changes according to P1.5 rules

#### Scenario: Prior reviewer loses normal action after reassignment
- **GIVEN** a submitted plan was reassigned from one reviewer to another
- **WHEN** the prior reviewer opens Plan approvals
- **THEN** the plan is not actionable by the prior reviewer

### Requirement: Planning lock blocks normal manager approval actions

The system SHALL prevent manager approve and request-changes actions after planning is locked. Locked approved plans SHALL remain readable as historical approved baselines, and locked unresolved plans SHALL NOT be approvable or returnable through normal P1.5 routes.

#### Scenario: Manager cannot approve after lock
- **GIVEN** a campaign whose planning is locked
- **WHEN** a manager attempts to approve a submitted plan
- **THEN** the system rejects the action
- **AND** does not change the plan status

#### Scenario: Manager cannot request changes after lock
- **GIVEN** a campaign whose planning is locked
- **WHEN** a manager attempts to request changes on a submitted plan
- **THEN** the system rejects the action
- **AND** does not add a review event

#### Scenario: Locked approved plan remains readable
- **GIVEN** a campaign whose planning is locked
- **AND** a plan was Approved before lock
- **WHEN** the assigned reviewer opens the plan detail
- **THEN** the reviewer can read the approved plan and review history
- **AND** no approval reversal, request-changes, reopen, or amendment action is offered

