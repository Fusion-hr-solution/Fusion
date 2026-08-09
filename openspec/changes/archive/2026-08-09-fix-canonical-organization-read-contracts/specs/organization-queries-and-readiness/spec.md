## MODIFIED Requirements

### Requirement: Upcoming changes and business-history queries

The system SHALL expose tenant-wide upcoming Organization changes and unit business history. Each item SHALL include its stable operation identifier, effective date, accurate affected-unit identity, display name, and business code, operation kind, structured business-event kinds, and typed before/after context. The contract SHALL represent Created, Renamed, Type changed, Moved, and Inactivated business semantics without client summary parsing or per-event reconstruction queries. Upcoming Changes SHALL preserve distinct same-date operations even when they normalize into one effective state. The API SHALL support safe cancellation of the specifically identified operation only for a caller with Organization.Manage and a cancellable state.

#### Scenario: Scheduled Move has structured context

- **WHEN** a Move is scheduled for a future effective date
- **THEN** Upcoming Changes exposes the operation identifier, affected unit name and code as distinct values, Moved business-event kind, and previous/resulting parent context

#### Scenario: No future changes

- **WHEN** no scheduled Organization state exists after today
- **THEN** the upcoming-changes query returns an empty collection rather than invented placeholder events

### Requirement: Derived Organization readiness

The system SHALL derive Organization readiness from persisted canonical state: a permanent root exists and the current official hierarchy validates as one connected acyclic tree. The canonical readiness query SHALL directly expose whether a permanent root identity exists, that root's stable identity when it exists, its first effective date, and whether it is currently effective, together with derived readiness. It SHALL not require a manual completion action, a minimum unit count, custom type configuration, scheduled-operation search, or client-side reconstruction.

#### Scenario: No root identity

- **WHEN** a tenant has no permanent root identity
- **THEN** the readiness contract reports no root identity and not Ready
- **AND** a caller with Organization.Manage may create the first root

#### Scenario: Future-only root is not currently ready

- **WHEN** the permanent root identity exists but its first effective date is in the future
- **THEN** the readiness contract reports that root identity and future first effective date, reports it as not currently effective, and does not resolve Ready
- **AND** a second root creation remains forbidden

#### Scenario: Root-only organization is ready

- **WHEN** a tenant has an active valid permanent root and no other active units
- **THEN** the readiness contract reports the root as currently effective and resolves Ready
