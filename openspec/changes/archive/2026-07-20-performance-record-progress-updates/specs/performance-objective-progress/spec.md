# performance-objective-progress Delta

## ADDED Requirements

### Requirement: Progress recording opens only on the locked approved baseline

The system SHALL accept an objective progress update only when the campaign's planning is locked, the acting employee's objective plan is Approved, the participant is not excluded, and the target objective belongs to that employee's plan in that campaign. Before planning lock, no progress recording SHALL exist anywhere in the product. Progress recording SHALL NOT modify any P1 planning data: locked objectives, weights, alignments, measurements, plan status, and review history remain immutable.

#### Scenario: Employee records progress after lock

- **GIVEN** a launched campaign whose planning is locked
- **AND** the signed-in employee's plan is Approved
- **WHEN** the employee records a progress update on one of their locked objectives
- **THEN** the system persists the update against that objective
- **AND** no locked planning field of the plan or objective changes

#### Scenario: Recording before planning lock is rejected

- **GIVEN** a launched campaign whose planning is not locked
- **WHEN** a progress update request arrives for an objective in that campaign
- **THEN** the server rejects it
- **AND** persists nothing

#### Scenario: Recording against another employee's objective is denied

- **WHEN** an employee attempts to record progress on an objective belonging to a different employee's plan
- **THEN** the system denies the operation and changes nothing

#### Scenario: Excluded participant has no recording path

- **GIVEN** a participant HR excluded from the planning lock requirement
- **WHEN** that employee attempts to record progress in the campaign
- **THEN** the server rejects the request

### Requirement: A progress update captures a canonical percent with optional context

The system SHALL require each progress update to carry a progress percent between 0 and 100 as the canonical progress value for every measurement method. An update MAY carry an optional comment (≤500 characters) and, for a Quantitative objective only, an optional actual-result value (≤120 characters) presented as context against the frozen indicator and target. The system SHALL NOT derive the percent from the actual-result value. Validation failures SHALL be reported per field and SHALL NOT discard the employee's entered values.

#### Scenario: Percent outside range is rejected

- **WHEN** a progress update arrives with a percent below 0 or above 100
- **THEN** the server rejects it with a validation error
- **AND** persists nothing

#### Scenario: Quantitative update carries an actual result

- **GIVEN** a locked Quantitative objective with a frozen indicator and target
- **WHEN** the employee records 60% with an actual-result value
- **THEN** the update is persisted with both the percent and the actual result
- **AND** the workspace presents the actual result alongside the frozen target as context

#### Scenario: Qualitative update is percent and comment only

- **GIVEN** a locked Qualitative objective
- **WHEN** the employee records progress
- **THEN** the form offers percent, comment, and evidence but no actual-result field

### Requirement: Progress history is append-only with traced regression

The system SHALL persist progress updates append-only: no application path SHALL edit or delete an existing update, for any role. Each stored update SHALL capture the acting user, timestamp (UTC), the canonical percent, and the previous latest percent at write time. When the new percent is lower than the previous latest percent, the system SHALL require an explicit regression confirmation and a short reason (≤300 characters) and SHALL reject the update otherwise. Corrections SHALL happen only through a new traced update.

#### Scenario: History rows never change

- **WHEN** application code attempts to modify or delete a persisted progress update
- **THEN** the persistence layer rejects the operation

#### Scenario: Lower value requires confirmed reason

- **GIVEN** an objective whose latest progress is 70%
- **WHEN** the employee submits 40% without a regression reason
- **THEN** the server rejects the update
- **AND** the workspace reveals the regression confirmation and reason entry while preserving the entered values

#### Scenario: Confirmed regression is fully traced

- **GIVEN** an objective whose latest progress is 70%
- **WHEN** the employee confirms 40% with a reason
- **THEN** the update is persisted carrying the previous value 70, the new value 40, the reason, the actor, and the timestamp

#### Scenario: Previous value is visible before recording

- **WHEN** the employee opens the record-progress action for an objective with prior updates
- **THEN** the current latest value is visible before any entry is made

### Requirement: Evidence attachments belong to a specific progress update

The system SHALL let the employee attach evidence files to a progress update using the shared attachment service, committed atomically with the update. Evidence SHALL be downloadable only by the owning employee and the participant's current effective reviewer; other callers SHALL be denied. Attachment size and content-type limits SHALL follow the shared attachment configuration. Evidence SHALL NOT be detachable from a persisted update.

#### Scenario: Update with evidence commits the files

- **WHEN** the employee records a progress update referencing uploaded pending attachments
- **THEN** the update persists and the attachments are committed to that update
- **AND** the evidence appears in the objective's history

#### Scenario: Unauthorized evidence download is denied

- **WHEN** a user who is neither the owning employee nor the participant's effective reviewer requests an evidence file
- **THEN** the system denies the download

#### Scenario: Failed update commits no evidence

- **WHEN** a progress update is rejected by validation
- **THEN** no referenced attachment is committed
- **AND** abandoned pending uploads are cleaned by the existing sweep

### Requirement: Objective state is derived from the latest update

The system SHALL derive each locked objective's progress state from its history, never from an editable stored status: no updates ⇒ Not started; latest update below 100 ⇒ In progress; latest update equal to 100 ⇒ Completed. A confirmed lower update after Completed SHALL return the objective to In progress. The system SHALL mark a non-completed objective stale when its newest update — or the planning-lock time when it has none — is older than the configured staleness threshold. Reads SHALL NOT mutate state.

#### Scenario: Latest value drives completion

- **GIVEN** an objective whose latest update is 100%
- **WHEN** any progress surface renders it
- **THEN** it presents as Completed without a separate completion action

#### Scenario: Confirmed regression reopens a completed objective

- **GIVEN** a Completed objective
- **WHEN** the employee records a confirmed lower update with a reason
- **THEN** the objective returns to In progress
- **AND** the completion and reopening both remain visible in history

#### Scenario: Silence beyond the threshold is stale

- **GIVEN** a non-completed objective with no update within the staleness threshold
- **WHEN** a progress surface renders it
- **THEN** it carries a stale signal

#### Scenario: Completed objectives are never stale

- **GIVEN** an objective whose latest update is 100%
- **WHEN** the staleness evaluation runs
- **THEN** the objective is not marked stale

### Requirement: Plan progress is the weighted sum over locked weights

The system SHALL compute plan-level progress as the sum of each objective's latest percent multiplied by its locked weight, divided by 100, and SHALL surface it wherever plan progress renders. Objectives with no updates contribute zero. The computation SHALL use only the frozen P1 weights.

#### Scenario: Weighted progress reflects latest values

- **GIVEN** an approved plan with objectives weighted 60 and 40 whose latest updates are 50% and 100%
- **WHEN** plan progress renders
- **THEN** it shows 70%

#### Scenario: Untouched plan shows zero

- **GIVEN** an approved plan with no progress updates
- **WHEN** plan progress renders
- **THEN** it shows 0% and every objective as Not started

### Requirement: The post-lock My objectives workspace becomes the progress record

The system SHALL render the employee's campaign My objectives workspace, once planning is locked and the plan is Approved, as the living progress workspace: the locked baseline context per objective (weight, deadline, measurement, alignment), a prominent weighted plan progress, per-objective current state with staleness, a record-progress action per objective, and a per-objective append-only history timeline showing value transitions, comments, actual results, evidence, actor, and time. Pre-lock plan states SHALL keep their existing P1 behavior. The workspace SHALL resolve to one truthful state — including planning-not-locked, empty, loading, recoverable error, and permission denied — in product language from the app's single terminology source, and SHALL render correctly on desktop, mobile, light, and dark.

#### Scenario: Locked approved plan renders the progress workspace

- **GIVEN** a locked campaign where the signed-in employee's plan is Approved
- **WHEN** the employee opens their campaign My objectives workspace
- **THEN** the workspace shows weighted plan progress, each locked objective's current state, and record-progress actions
- **AND** the locked baseline remains visible and read-only

#### Scenario: History reads as an append-only narrative

- **WHEN** the employee opens an objective's history
- **THEN** updates render most-recent-first with previous-to-new value transitions, regression reasons where present, comments, evidence, actor, and time
- **AND** no edit or delete affordance exists on any entry

#### Scenario: Recording updates the workspace without refresh

- **WHEN** the employee records a valid progress update
- **THEN** the objective's state, plan progress, and history reflect it without a manual page refresh

#### Scenario: Pre-lock behavior is unchanged

- **GIVEN** a launched campaign whose planning is not locked
- **WHEN** the employee opens their campaign workspace
- **THEN** the existing P1 planning states render unchanged and no progress surface appears

### Requirement: Progress operations are authorized deny-by-default and tenant-isolated

The system SHALL deny progress operations by default. Recording and reading one's own progress SHALL require the employee self-manage objective permission (`performance.objective.self.manage`, Self scope) and an employee-linked account owning the plan. HR, Direction, and managers SHALL have no write path to an employee's progress in this slice. All operations SHALL be scoped to the acting tenant; cross-tenant targets SHALL answer as not found.

#### Scenario: Missing permission is denied

- **GIVEN** an account without the self-manage objective permission
- **WHEN** it attempts to read or record progress
- **THEN** the system denies the operation

#### Scenario: No non-owner write path exists

- **WHEN** any caller other than the owning employee — including HR or the effective reviewer — attempts to record, correct, or remove progress on a plan
- **THEN** the system denies the operation and changes nothing

#### Scenario: Cross-tenant progress answers not found

- **WHEN** a caller targets a plan, objective, update, or evidence file belonging to another tenant
- **THEN** the system responds as not found and mutates nothing

### Requirement: Progress activity is audited and meaningful transitions notify

The system SHALL raise domain events for recorded progress and dispatch them after successful persistence: every recorded update SHALL write an activity-log entry identifying actor, tenant, campaign, plan, objective, and the value transition; objective completion and confirmed reopening SHALL create deduplicated notifications for the participant's effective reviewer with a contextual route into the manager's view. Routine updates SHALL NOT notify the reviewer. Handlers SHALL be duplicate-safe per the domain-event contract.

#### Scenario: Recorded update writes activity

- **WHEN** an employee records a progress update
- **THEN** an activity-log entry captures the actor and the previous-to-new value transition for that objective

#### Scenario: Completion notifies the effective reviewer once

- **WHEN** an objective's latest value reaches 100%
- **THEN** the effective reviewer receives an objective-completed notification deep-linking to the participant's progress
- **AND** a duplicate dispatch of the same logical event creates no second notification

#### Scenario: Routine update stays quiet

- **WHEN** an employee records an update that neither completes nor reopens an objective
- **THEN** no reviewer notification is created

### Requirement: A scheduled job reminds employees of stale objectives

The system SHALL run a scheduled stale-progress job over locked campaigns that notifies the owning employee for each non-completed objective whose progress is stale, using the shared scheduled-job runner and deduplication so repeated runs within the same staleness window do not re-notify.

#### Scenario: Stale objective triggers one reminder

- **GIVEN** a locked campaign with an objective stale beyond the threshold
- **WHEN** the stale-progress job runs twice in the same window
- **THEN** the owning employee has exactly one stale-progress notification for that objective

#### Scenario: Fresh and completed objectives are skipped

- **WHEN** the stale-progress job runs
- **THEN** objectives with recent updates or Completed state produce no reminder
