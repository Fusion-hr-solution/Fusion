## ADDED Requirements

### Requirement: The Performance overview and sidebar present a consistent set of doors

The Performance overview (landing) and the sidebar SHALL be driven by a single shared source of navigation doors, so that a role sees the same set of workspaces, with the same labels and order, in both places. Adding or removing a workspace SHALL update the overview and the sidebar together; the two MUST NOT drift.

#### Scenario: A newly added workspace appears in both overview and sidebar
- **WHEN** a workspace door (for example, Team progress) is available to the user's role
- **THEN** it appears in both the overview and the sidebar, with matching label and consistent ordering

#### Scenario: Overview and sidebar never disagree on available doors
- **WHEN** the overview and sidebar are rendered for the same user
- **THEN** the set of workspace doors is identical between them (no door present in one and missing from the other)

### Requirement: Door emphasis reflects operational state, not decoration

Visual emphasis on an overview door SHALL communicate actual operational state (for example, work awaiting the user), not a fixed decorative style. A door SHALL NOT carry a persistent "attention" treatment when there is nothing for the user to act on.

#### Scenario: Attention emphasis is shown only when action is pending
- **WHEN** an overview door has no pending work for the user
- **THEN** it is not rendered with an attention/warning emphasis reserved for actionable state
