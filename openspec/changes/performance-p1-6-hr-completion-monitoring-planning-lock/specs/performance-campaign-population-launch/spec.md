## ADDED Requirements

### Requirement: Post-launch closure adjustments preserve the frozen participant baseline

The system SHALL preserve the frozen P1.2 participant and approver baseline after launch. Any P1.6 participant exclusion from lock readiness or campaign-specific reviewer reassignment SHALL be stored as separate closure data, SHALL remain traceable to the original frozen participant, and SHALL NOT delete, recreate, or rewrite the launch baseline.

#### Scenario: Participant exclusion does not rewrite launch population
- **GIVEN** a launched campaign with a frozen participant
- **WHEN** HR excludes that participant from the P1.6 lock requirement
- **THEN** the frozen participant remains in the launched baseline
- **AND** the exclusion is recorded as closure data with reason and audit

#### Scenario: Reviewer reassignment preserves original frozen approver
- **GIVEN** a launched campaign whose frozen baseline captured an approver for a participant
- **WHEN** HR reassigns the participant's campaign reviewer in P1.6
- **THEN** the original frozen approver remains visible for traceability
- **AND** the new reviewer is represented as campaign-specific reassignment data
- **AND** Core reporting lines are not updated
