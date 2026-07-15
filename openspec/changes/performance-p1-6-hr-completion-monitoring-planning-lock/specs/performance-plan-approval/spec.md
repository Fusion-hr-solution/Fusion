## ADDED Requirements

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
