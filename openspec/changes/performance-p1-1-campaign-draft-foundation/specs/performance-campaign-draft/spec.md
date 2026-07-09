## ADDED Requirements

### Requirement: HR creates a campaign Draft with identity

The system SHALL allow an authorized HR user to create a performance-planning campaign in `Draft` status with a campaign name, a reference year, a short purpose/planning guidance, and an owner that is automatically the creating user. `Draft` SHALL be the only campaign status reachable in this slice.

#### Scenario: Create a Draft with valid identity

- **WHEN** an authorized HR user submits a campaign name, a reference year within the allowed range, and an optional purpose
- **THEN** the system creates a campaign in `Draft` status scoped to the acting tenant
- **AND** records the owner as the creating user
- **AND** returns the created Draft without requiring a manual refresh to see it

#### Scenario: Campaign name is required

- **WHEN** an authorized HR user submits an empty or whitespace-only campaign name
- **THEN** the system rejects the creation with a validation reason naming the campaign name
- **AND** does not create any campaign
- **AND** preserves the other entered values

#### Scenario: Reference year must be within the allowed range

- **WHEN** an authorized HR user submits a reference year outside the supported range
- **THEN** the system rejects the creation with a validation reason naming the reference year
- **AND** does not create any campaign

### Requirement: HR defines the campaign planning schedule

The system SHALL let an authorized HR user set the campaign planning schedule as four dates — planning opening date, employee submission deadline, manager approval deadline, and expected planning lock date — and SHALL enforce non-decreasing chronological order across those four dates.

#### Scenario: Schedule in valid order is accepted

- **WHEN** an authorized HR user sets planning opening ≤ employee submission deadline ≤ manager approval deadline ≤ expected planning lock date
- **THEN** the system stores the schedule on the Draft

#### Scenario: Out-of-order schedule is rejected

- **WHEN** an authorized HR user sets any later milestone date earlier than an earlier one (for example, manager approval deadline before employee submission deadline)
- **THEN** the system rejects the change with a validation reason identifying the offending date pair
- **AND** does not persist the invalid schedule
- **AND** preserves the entered dates for correction

### Requirement: Campaign Draft freezes a snapshot of tenant objective-planning rules

The system SHALL copy the tenant's current objective-planning configuration — maximum objective count, allowed weight menu, and enabled measurement methods — into the campaign Draft at creation time, and SHALL treat that snapshot as frozen and read-only for the life of the Draft in this slice.

#### Scenario: Snapshot captured at creation

- **WHEN** a campaign Draft is created while the tenant has an applied objective-planning configuration
- **THEN** the Draft stores a copy of the current maximum objective count, allowed weight menu, and enabled measurement methods
- **AND** the copied rules are presented read-only on the Draft

#### Scenario: Snapshot does not change when tenant configuration later changes

- **GIVEN** a campaign Draft created with a captured snapshot
- **WHEN** the tenant later applies a different objective-planning configuration
- **THEN** the campaign Draft continues to show the values captured at its creation
- **AND** the system does not re-sync the snapshot in this slice

#### Scenario: Creation requires an applied tenant configuration

- **WHEN** an HR user attempts to create a campaign Draft while the tenant has no applied objective-planning configuration
- **THEN** the system blocks creation with a reason that tenant objective-planning rules must be configured first
- **AND** does not create a campaign

### Requirement: HR edits a campaign Draft with dirty-state and concurrency safety

The system SHALL let an authorized HR user edit a campaign Draft's identity and schedule while it is in `Draft`, SHALL apply edits atomically, and SHALL reject stale writes using an optimistic concurrency token without losing the user's entered values.

#### Scenario: Edit applies atomically

- **WHEN** an authorized HR user changes Draft identity or schedule fields and submits with the current concurrency token
- **THEN** the system applies all changes together and returns the updated Draft

#### Scenario: Stale write is rejected as a conflict

- **WHEN** an authorized HR user submits an edit with a concurrency token that no longer matches the stored Draft
- **THEN** the system rejects the write as a conflict distinct from a validation error
- **AND** does not partially apply the edit
- **AND** the client can recover without losing entered values

### Requirement: Campaign Draft completeness is validated for later population

The system SHALL expose whether a campaign Draft is complete enough to be handed to later population/activation — requiring a name, a reference year, a complete and correctly ordered schedule, a captured rules snapshot, and at least one active strategic objective — without performing any population or activation in this slice.

#### Scenario: Complete Draft reports ready-for-population

- **GIVEN** a Draft with valid identity, a complete ordered schedule, a captured snapshot, and at least one active strategic objective
- **WHEN** completeness is evaluated
- **THEN** the system reports the Draft as complete enough for later population
- **AND** performs no population or activation

#### Scenario: Incomplete Draft reports blocking reasons

- **GIVEN** a Draft missing a required element (for example, no active strategic objective or an incomplete schedule)
- **WHEN** completeness is evaluated
- **THEN** the system reports the Draft as not yet complete
- **AND** lists the specific missing elements

### Requirement: Campaign Draft operations are tenant-isolated

The system SHALL scope all campaign Draft reads and writes to the acting tenant and SHALL never return or mutate another tenant's campaign.

#### Scenario: Cross-tenant read is denied

- **WHEN** a user requests a campaign Draft that belongs to a different tenant
- **THEN** the system does not return the campaign and responds as not found for that tenant

#### Scenario: Cross-tenant write is denied

- **WHEN** a user attempts to edit a campaign Draft that belongs to a different tenant
- **THEN** the system rejects the write and does not mutate the other tenant's data

### Requirement: Campaign Draft management is authorized deny-by-default

The system SHALL require an explicit tenant-scoped campaign-management permission to create or edit a campaign Draft, require a campaign-view (or management) permission to read campaigns, and SHALL deny by default.

#### Scenario: Unpermitted user cannot create or edit

- **WHEN** a signed-in user without campaign-management permission attempts to create or edit a campaign Draft
- **THEN** the system denies the operation
- **AND** does not create or change any campaign

#### Scenario: View-only user can read but not edit

- **GIVEN** a user with campaign-view permission but not campaign-management permission
- **WHEN** the user opens a campaign Draft
- **THEN** the system returns the Draft in a read-only form
- **AND** rejects any edit attempt from that user

### Requirement: Campaign Draft creation and meaningful changes are audited

The system SHALL record audit facts — acting user, timestamp, and the changed facts — for campaign Draft creation and for meaningful changes (identity, schedule, snapshot capture, and strategic-objective changes), reusing the existing Performance audit mechanism without exposing a dedicated history product.

#### Scenario: Creation is recorded

- **WHEN** a campaign Draft is created
- **THEN** the system records an audit fact capturing the acting user, timestamp, and created campaign identity

#### Scenario: Meaningful edit is recorded

- **WHEN** an authorized HR user changes the Draft schedule or identity
- **THEN** the system records an audit fact capturing the acting user, timestamp, and what changed

### Requirement: Reads never mutate campaign state

The system SHALL ensure that listing, opening, or evaluating completeness of campaign Drafts performs no writes to campaign, snapshot, or audit tables beyond append-only access logging where already standard.

#### Scenario: Listing campaigns creates no campaign rows

- **WHEN** an authorized user lists campaigns or opens a Draft
- **THEN** the system returns data without creating or modifying any campaign or snapshot row
