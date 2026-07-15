# performance-planning-completion-lock Specification

## Purpose
TBD - created by archiving change performance-p1-6-hr-completion-monitoring-planning-lock. Update Purpose after archive.
## Requirements
### Requirement: HR monitors planning completion for the frozen participant baseline

The system SHALL provide an HR planning completion view for each launched campaign that is computed from the campaign's frozen P1.2 participant baseline. The view SHALL include every frozen participant unless the participant has been formally excluded from the lock requirement, and SHALL NOT add or remove participants based on live Core reporting-line or org changes.

#### Scenario: Completion view includes every frozen participant
- **GIVEN** a launched campaign with frozen participants
- **WHEN** an authorized HR user opens the planning completion view
- **THEN** the system returns a completion row for each frozen participant
- **AND** does not derive the list from live Core reporting lines

#### Scenario: Non-participant employee is not shown
- **GIVEN** an employee who is not part of the frozen participant baseline
- **WHEN** HR opens the campaign completion view
- **THEN** the employee is not included in completion counts or participant rows

### Requirement: Participant completion status is grouped in product language

The system SHALL classify each frozen participant into one of these product status groups: Not started, Draft, Submitted, Changes requested, Approved, Excluded, or Blocked. Status SHALL be derived from the participant's objective plan, P1.5 review state, P1.6 exclusion state, and blocker checks, and SHALL NOT expose backend enum names as user-facing labels.

#### Scenario: Participant with no plan is not started
- **GIVEN** a frozen participant with no employee objective plan
- **WHEN** HR views completion monitoring
- **THEN** the participant appears as Not started

#### Scenario: Participant with approved plan is approved
- **GIVEN** a frozen participant whose employee objective plan is Approved
- **WHEN** HR views completion monitoring
- **THEN** the participant appears as Approved

#### Scenario: Participant with exclusion reason is excluded
- **GIVEN** a frozen participant that HR excluded from the lock requirement with a reason
- **WHEN** HR views completion monitoring
- **THEN** the participant appears as Excluded
- **AND** the exclusion reason is visible to authorized HR users

### Requirement: Completion view surfaces blockers and overdue indicators

The system SHALL surface participant-level blockers that prevent normal completion, including missing effective approver, inactive/unavailable approver when detectable, self-approval assignment, inconsistent plan/review state, or other lock-blocking data issues. The system SHALL surface overdue indicators only when supported by campaign schedule dates, including employee submission deadline and manager approval deadline.

#### Scenario: Self-approval is a blocker
- **GIVEN** a frozen participant whose effective approver is the same employee
- **WHEN** HR views completion monitoring
- **THEN** the participant is flagged as Blocked
- **AND** the blocker identifies self-approval as a data issue

#### Scenario: Employee submission deadline creates overdue visibility
- **GIVEN** a campaign whose employee submission deadline has passed
- **AND** a participant has no submitted or approved plan
- **WHEN** HR views the participant row
- **THEN** the row indicates that employee submission is overdue

#### Scenario: Unsupported deadline does not create invented overdue state
- **GIVEN** the system lacks a reliable deadline for a specific overdue rule
- **WHEN** HR views completion monitoring
- **THEN** the system omits that overdue indicator
- **AND** does not infer or invent a deadline

### Requirement: HR records lightweight reminder actions and history

The system SHALL let authorized HR users record a reminder action for a participant, reviewer, or grouped completion issue. A reminder action SHALL capture target, reason or context, actor, timestamp, campaign, and participant or plan where applicable. If a notification delivery mechanism is available, the system MAY trigger it, but reminder history SHALL be recorded even when delivery is not performed.

#### Scenario: HR records a participant reminder
- **GIVEN** a participant needs follow-up
- **WHEN** an authorized HR user records a reminder with a target and reason
- **THEN** the reminder appears in the participant's reminder history
- **AND** the action is audited

#### Scenario: Reminder delivery is optional
- **GIVEN** no notification delivery mechanism is available for the reminder target
- **WHEN** HR records the reminder
- **THEN** the system records the reminder intent and history
- **AND** does not fail solely because no notification was delivered

### Requirement: HR reassigns a participant reviewer for the campaign with reason

The system SHALL let authorized HR users reassign the effective campaign reviewer for a participant with a required reason. Reassignment SHALL be campaign-specific, SHALL preserve previous reviewer history, SHALL NOT update Core reporting lines, and SHALL make pending manager review actions available to the new effective reviewer.

#### Scenario: Reassignment changes the effective reviewer only for the campaign
- **GIVEN** a launched campaign with a participant assigned to a frozen approver
- **WHEN** authorized HR reassigns that participant to another valid tenant employee with a reason
- **THEN** the participant's effective reviewer for this campaign becomes the new employee
- **AND** the original frozen approver remains traceable
- **AND** Core reporting lines are not changed

#### Scenario: Reassignment requires a reason
- **GIVEN** HR attempts to reassign a participant reviewer without a reason
- **WHEN** the request is submitted
- **THEN** the system rejects the reassignment
- **AND** does not change the effective reviewer

#### Scenario: Reassigned reviewer receives pending review responsibility
- **GIVEN** a participant has a Submitted plan awaiting review
- **WHEN** HR reassigns the participant reviewer
- **THEN** the submitted plan becomes reviewable by the new effective reviewer
- **AND** is no longer actionable by the prior reviewer through normal approval routes

### Requirement: HR excludes a participant from the lock requirement with reason

The system SHALL let authorized HR users exclude a frozen participant from the planning lock requirement with a required reason. Exclusion SHALL NOT delete the participant, rewrite the frozen baseline, delete objectives, approve a plan, or remove historical review data. Exclusion SHALL be auditable and SHALL satisfy lock readiness for that participant.

#### Scenario: Exclusion preserves the frozen participant
- **GIVEN** a frozen participant is no longer relevant for the campaign
- **WHEN** authorized HR excludes the participant with a reason
- **THEN** the participant remains in the historical frozen baseline
- **AND** the participant is marked Excluded for lock readiness
- **AND** the reason and actor are recorded

#### Scenario: Exclusion requires a reason
- **GIVEN** HR attempts to exclude a participant without a reason
- **WHEN** the request is submitted
- **THEN** the system rejects the exclusion
- **AND** the participant remains included in lock readiness

### Requirement: Planning lock readiness requires every participant to be approved or excluded

The system SHALL determine a launched campaign is ready to lock only when every frozen participant is either Approved or Excluded with reason. If any participant is Not started, Draft, Submitted, Changes requested, or Blocked, the system SHALL refuse planning lock and return grouped reasons.

#### Scenario: Campaign is ready when all participants are approved or excluded
- **GIVEN** every frozen participant in a launched campaign is Approved or Excluded with reason
- **WHEN** HR checks lock readiness
- **THEN** the system reports that planning can be locked

#### Scenario: Campaign is not ready while any participant remains unresolved
- **GIVEN** a launched campaign has a participant in Submitted state
- **WHEN** HR checks lock readiness
- **THEN** the system reports that planning cannot be locked
- **AND** includes the participant in grouped remaining action reasons

### Requirement: HR locks planning as the P2 baseline handoff

The system SHALL let an authorized HR operator lock planning only when lock readiness passes. Lock SHALL record the lock timestamp, actor, and audit event; SHALL make approved plans immutable through normal P1 flows; SHALL make completion monitoring read-only; and SHALL expose the approved objectives as the locked planning baseline for P2 consumption. Lock SHALL NOT create progress tracking, scoring, evaluation, or amendment workflows.

#### Scenario: HR locks a ready campaign
- **GIVEN** a launched campaign whose lock readiness passes
- **WHEN** an authorized HR operator confirms planning lock
- **THEN** the campaign records planning lock actor and timestamp
- **AND** the action is audited
- **AND** approved objective plans become locked P2 baseline candidates

#### Scenario: Lock is refused when readiness fails
- **GIVEN** a launched campaign with unresolved participants
- **WHEN** HR attempts to lock planning
- **THEN** the system rejects the lock
- **AND** returns grouped readiness blockers
- **AND** does not set lock metadata

#### Scenario: Post-lock monitoring is read-only
- **GIVEN** a campaign whose planning is locked
- **WHEN** HR opens completion monitoring
- **THEN** the system shows the locked baseline state
- **AND** does not offer reminder, reassignment, exclusion, or lock actions through normal P1.6 flow

### Requirement: Planning completion and lock are authorized and tenant-isolated

The system SHALL deny P1.6 operations by default and SHALL scope all reads and writes to the acting tenant. Viewing planning completion SHALL require tenant-scoped campaign view or management permission. Recording reminders, excluding participants, and reassigning reviewers SHALL require tenant-scoped campaign management permission. Locking planning SHALL require tenant-scoped campaign operation permission. Cross-tenant targets SHALL answer as not found or forbidden without leaking data.

#### Scenario: Unpermitted user cannot view completion
- **GIVEN** a signed-in user without campaign view or management permission
- **WHEN** they request planning completion for a campaign
- **THEN** the system denies access

#### Scenario: Manage permission is required for blocker resolution
- **GIVEN** a signed-in user with campaign view permission only
- **WHEN** they attempt to exclude a participant or reassign a reviewer
- **THEN** the system denies the action

#### Scenario: Cross-tenant participant is not reachable
- **GIVEN** a participant belongs to another tenant
- **WHEN** a user attempts a P1.6 action against that participant
- **THEN** the system does not expose or mutate that participant
