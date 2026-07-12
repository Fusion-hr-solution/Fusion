## MODIFIED Requirements

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
