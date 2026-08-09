## ADDED Requirements

### Requirement: Effective-dated creation and Change
Creating a root or non-root Organizational Unit SHALL create stable identity and an effective state at an explicit calendar date. Ordinary Change SHALL create new business truth from its date while preserving prior business truth, and may change only name and/or type. Non-root creation SHALL require an active valid parent on its effective date. Future changes SHALL NOT alter today's result.

#### Scenario: Future creation remains absent today
- **WHEN** a non-root unit is scheduled for a future date
- **THEN** today's hierarchy excludes it and the hierarchy on that future date includes it under its selected parent

#### Scenario: Parent is not an ordinary edit field
- **WHEN** an ordinary Change requests a parent modification
- **THEN** the system rejects it and requires the dedicated Move operation

### Requirement: Stable scheduled-operation identity
Each business operation SHALL have a stable operation identity independent of the normalized resulting effective-state snapshot. Multiple legitimate operations on the same unit and effective date SHALL remain individually addressable even when they resolve to one state. Upcoming Changes SHALL expose an identifier sufficient to target a specific scheduled operation.

#### Scenario: Same-date rename and Move remain distinct
- **WHEN** a Rename and a Move for Technology are both scheduled for Sep 1
- **THEN** Sep 1 resolves to one resulting Technology state
- **AND** Upcoming Changes exposes distinct identifiable Rename and Move operations

#### Scenario: Cancel one same-date scheduled operation
- **WHEN** a caller with Organization.Manage cancels the scheduled Rename but not the scheduled Move for the same unit and date
- **THEN** the resulting timeline is recomputed and revalidated
- **AND** the Move remains scheduled and independently addressable

### Requirement: Dedicated effective-dated subtree Move
Move SHALL be a dedicated command accepting source unit, target parent, effective date, and concurrency version. It SHALL change only the source unit's parent state and SHALL move the whole resolved subtree by preserving all descendant identities and descendant-to-source relationships. The server SHALL validate the resulting hierarchy at the move date and relevant scheduled boundaries.

#### Scenario: Descendant move target rejected
- **WHEN** a unit is moved beneath itself or a descendant as of the selected date
- **THEN** the system rejects the move without changing any state

#### Scenario: Scheduled move
- **WHEN** a valid move is scheduled for a future date
- **THEN** the current parent remains unchanged and the future as-of hierarchy resolves the moved subtree beneath the target parent

### Requirement: Terminal inactivation and safe future cancellation
Inactivation of an effective non-root unit SHALL create terminal inactive business state from the supplied date. The system SHALL not reactivate the same identity. It SHALL reject inactivation when active descendants would become structurally invalid at any affected date. A never-effective future operation MAY be cancelled by its stable operation identity only when recomputation preserves valid historical and scheduled Organization truth; cancellation SHALL NOT unintentionally cancel unrelated same-date operations.

#### Scenario: Active descendants block inactivation
- **WHEN** a unit has active descendants at its requested inactivation date
- **THEN** inactivation is rejected with the affected structural reason

#### Scenario: Cancel future move
- **WHEN** a caller with Organization.Manage cancels a never-effective scheduled move by its operation identity and the recomputed timeline remains valid
- **THEN** the old parent relationship resolves at and after the cancelled date until another valid state changes it

### Requirement: Change and Correction are distinct
The system SHALL distinguish Change from Correction. Change creates true business history from an effective date. Correction repairs a specifically identified recorded state that was never true, requires a reason, revalidates every affected hierarchy boundary, and records audit evidence without creating a false business-change event.

#### Scenario: Historical correction
- **WHEN** a caller with Organization.Manage corrects a historical state with a reason
- **THEN** affected as-of results are re-resolved, audit history identifies the correction and reason, and business history does not portray the repair as a new business event

### Requirement: Mutation concurrency token advancement
Every successful mutation affecting an Organizational Unit SHALL advance the aggregate concurrency token exposed to clients, including Change, Move, Inactivate, scheduled-operation cancellation, state Correction, and business-code Correction. A previously returned ETag/expected version SHALL not remain valid after such a mutation succeeds.

#### Scenario: Scheduled operation invalidates stale ETag
- **WHEN** a caller successfully schedules a Move for a unit
- **THEN** the unit returns an advanced concurrency token
- **AND** a later mutation using the prior token is rejected as stale

### Requirement: Meaningful business history
The system SHALL provide human-readable business history derived from effective-state differences, including created, renamed, type changed, moved, and inactivated events. Future changes SHALL be identifiable as scheduled. Business history SHALL remain distinct from technical/compliance audit history.

#### Scenario: Move history context
- **WHEN** a unit is moved from one parent to another
- **THEN** its history identifies the effective date and before/after parent context rather than raw state-row values
