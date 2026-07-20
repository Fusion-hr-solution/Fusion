# performance-team-progress Delta

## ADDED Requirements

### Requirement: Effective reviewers see progress for their assigned participants only

The system SHALL expose team progress for a locked launched campaign to the participant's effective reviewer — the frozen approver adjusted by campaign reviewer reassignments — and to no other role in this slice. The visible population SHALL be the reviewer's assigned, non-excluded frozen participants with Approved plans. The scope SHALL NOT be derived from live Core reporting lines, and HR and Direction SHALL have no team-progress surface in this slice.

#### Scenario: Reviewer sees exactly their assigned participants

- **GIVEN** a locked campaign where the signed-in manager is effective reviewer for some participants
- **WHEN** the manager opens the campaign's team progress workspace
- **THEN** it lists exactly those assigned participants with Approved plans
- **AND** participants assigned to other reviewers are absent

#### Scenario: Reassignment moves progress visibility

- **GIVEN** HR reassigned a participant's campaign reviewer to a new manager
- **WHEN** each manager opens team progress
- **THEN** the participant appears for the new effective reviewer and not for the prior one

#### Scenario: Live reporting-line change does not alter scope

- **WHEN** Core later changes a participant's manager
- **THEN** the campaign's team progress scope still follows the frozen approver and recorded reassignments

### Requirement: The team progress workspace is attention-first

The system SHALL order and group the team progress workspace by attention: participants and objectives carrying signals — stale progress, recent confirmed regression, not started — SHALL surface ahead of routine in-progress work, with completed work calmest. Each participant row SHALL show weighted plan progress and its attention signals; each objective SHALL show current percent, derived state, staleness, and last-update time. Signals SHALL be conveyed by shape and text, not color alone, and the workspace SHALL render correctly on desktop, mobile, light, and dark.

#### Scenario: Attention orders the workspace

- **GIVEN** assigned participants with stale, regressed, untouched, and completed objectives
- **WHEN** the workspace renders
- **THEN** participants needing attention appear before routine ones
- **AND** each attention signal states its cause in product language

#### Scenario: Fully progressing team reads calm

- **GIVEN** all assigned participants have fresh in-progress or completed objectives
- **WHEN** the workspace renders
- **THEN** no attention signals appear and the workspace presents steady progress truthfully

### Requirement: Reviewer drills into a participant's objective history read-only

The system SHALL let the effective reviewer open an assigned participant's objective detail: locked baseline context, current derived state, the full append-only progress history with comments, actual results, regression reasons, and evidence downloads. The entire surface SHALL be read-only — no action offered SHALL mutate the participant's progress, plan, or objectives, and reads SHALL NOT mutate state.

#### Scenario: History detail is complete and read-only

- **WHEN** the reviewer opens an assigned participant's objective
- **THEN** the full progress history renders with value transitions, reasons, comments, and evidence
- **AND** no edit, delete, record, or correction affordance exists

#### Scenario: Evidence opens for the reviewer

- **WHEN** the reviewer downloads an evidence file from an assigned participant's update
- **THEN** the file streams successfully per the attachment authorization

### Requirement: Team progress is authorized deny-by-default and tenant-isolated

The system SHALL deny team-progress reads by default. Access SHALL require the team-progress view permission (`performance.objective.progress.team.view`) on an employee-linked account, and SHALL be operationally limited to participants for whom the caller is the current effective reviewer. Holding the permission without reviewer scope SHALL yield truthful empty states, not other employees' data. Cross-tenant targets SHALL answer as not found.

#### Scenario: Permission without scope shows an empty state

- **GIVEN** an account holding the team-progress permission that is effective reviewer for no participant in any locked campaign
- **WHEN** it opens team progress
- **THEN** a truthful empty state renders and no participant data is returned

#### Scenario: Non-reviewer participant detail is denied

- **WHEN** a permitted manager requests progress detail for a participant they do not currently review
- **THEN** the system denies the request and returns no progress data

#### Scenario: Cross-tenant team progress answers not found

- **WHEN** a manager targets a campaign or participant belonging to another tenant
- **THEN** the system responds as not found
