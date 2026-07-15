## ADDED Requirements

### Requirement: HR reaches planning completion from the campaign workspace

The system SHALL expose planning completion and lock as an HR campaign workspace for users with tenant-scoped campaign view or management permission. The route SHALL be anchored under the campaign context, SHALL keep breadcrumbs under `Campaigns` -> campaign name -> completion, and SHALL NOT be mixed with employee `My objectives`, manager `Team objectives`, or manager `Plan approvals` workspaces.

#### Scenario: HR sees completion entry for launched campaign
- **GIVEN** a signed-in HR user with campaign view or management permission
- **AND** a launched campaign exists
- **WHEN** the user opens the campaign workspace
- **THEN** planning completion is reachable from that campaign context
- **AND** the breadcrumb remains anchored under Campaigns

#### Scenario: Completion workspace is distinct from manager and employee doors
- **GIVEN** a manager who is also an employee and also has HR campaign access
- **WHEN** the Performance navigation renders
- **THEN** My objectives, Team objectives, Plan approvals, and campaign planning completion remain distinct workspaces
- **AND** no workspace reuses another workspace's labels or routes for P1.6 closure

#### Scenario: Unpermitted user does not see completion workspace
- **GIVEN** a signed-in user without campaign view or management permission
- **WHEN** Performance navigation renders
- **THEN** the planning completion workspace is not shown

### Requirement: Planning completion surfaces truthful page states

The system SHALL render planning completion loading, empty/not-launched, permission-denied, recoverable-error, actionable, blocked, ready-to-lock, and locked read-only states with product language and design-system components. The surface SHALL be responsive and theme-safe in light and dark mode.

#### Scenario: Draft campaign has no completion workflow
- **GIVEN** a campaign is still Draft
- **WHEN** HR opens its completion route
- **THEN** the page states that planning completion starts after launch
- **AND** does not show participant completion counts as if they were frozen

#### Scenario: Ready campaign presents lock action
- **GIVEN** every frozen participant is Approved or Excluded with reason
- **WHEN** HR opens planning completion
- **THEN** the page presents the campaign as ready to lock
- **AND** the lock action requires deliberate confirmation

#### Scenario: Locked campaign is read-only
- **GIVEN** a campaign whose planning is locked
- **WHEN** HR opens planning completion
- **THEN** the page shows the locked baseline state
- **AND** does not offer reminder, reassignment, exclusion, or lock actions
