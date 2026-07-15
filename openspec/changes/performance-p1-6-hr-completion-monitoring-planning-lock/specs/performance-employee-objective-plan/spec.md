## ADDED Requirements

### Requirement: Planning lock blocks normal employee objective authoring

The system SHALL prevent normal employee objective creation, editing, deletion, submission, and resubmission for a campaign after planning is locked. Locked approved plans SHALL remain readable to the owning employee as the planning baseline. Locked unresolved or excluded participant states SHALL NOT create an employee edit path through P1 planning.

#### Scenario: Locked approved plan is read-only to employee
- **GIVEN** a campaign whose planning is locked
- **AND** the employee's objective plan is Approved
- **WHEN** the employee opens My objectives
- **THEN** the plan is shown read-only as the locked planning baseline
- **AND** no edit, delete, submit, or resubmit action is offered

#### Scenario: Locked changes-requested plan cannot be resubmitted
- **GIVEN** a campaign whose planning is locked
- **AND** the employee's plan is Changes requested
- **WHEN** the employee attempts to edit or resubmit
- **THEN** the system rejects the action
- **AND** explains that planning is locked

#### Scenario: Server enforces lock regardless of client state
- **GIVEN** a campaign whose planning is locked
- **WHEN** a client submits an objective mutation or resubmission request
- **THEN** the server rejects the request
- **AND** does not modify the plan or objective records
