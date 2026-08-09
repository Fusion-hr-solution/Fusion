## ADDED Requirements

### Requirement: Stable tenant-owned Organizational Unit identity
Core HR SHALL model an Organizational Unit as a stable identity with immutable owning tenant and required tenant-unique business code. Code uniqueness SHALL apply to proposed/planned units as well as effective units. Name SHALL be a required display label, SHALL NOT be an identity key, and MAY repeat within a tenant. An Organizational Unit SHALL never move between tenants.

#### Scenario: Duplicate names in separate branches
- **WHEN** two active units in one tenant have the same name and distinct business codes
- **THEN** the system accepts both units and resolves them by stable identity/code/path

#### Scenario: Cross-tenant identity mutation
- **WHEN** a command attempts to attach an Organizational Unit or its state to another tenant
- **THEN** the system rejects the command and leaves the owning tenant unchanged

### Requirement: Business-code reservation and correction
The system SHALL normalize and enforce tenant uniqueness for Organizational Unit business codes, including proposed/planned codes. Once a unit has first become effective, its code SHALL be reserved permanently to that identity and SHALL NOT be reused by another unit in the tenant. Ordinary effective-dated Changes SHALL NOT modify code; a code repair SHALL require an audited, reason-required Correction. Subject to proposed/effective code uniqueness, a correction target code SHALL be valid only when it is unreserved or already permanently reserved to the same Organizational Unit identity; a reservation belonging to another identity SHALL always reject the correction. All prior effective codes SHALL remain permanently reserved to their original identity.

#### Scenario: Retired unit code remains reserved
- **WHEN** an effective unit is retired and another unit is created with its former code
- **THEN** the system rejects the creation

#### Scenario: Never-effective proposed code changes
- **WHEN** a future unit has never become effective and its proposed code is changed or its creation is safely cancelled
- **THEN** the prior proposed code is not permanently reserved

#### Scenario: Effective code correction
- **WHEN** a caller with Organization.Manage supplies a valid correction reason and a target code that is unreserved or already reserved to that effective unit identity
- **THEN** the system changes the unit's code through the exceptional correction path, audits it, and reserves both values to that same unit identity

#### Scenario: Other identity's reservation blocks code correction
- **WHEN** a caller with Organization.Manage corrects an effective unit to a code permanently reserved to another Organizational Unit identity
- **THEN** the system rejects the correction and preserves both units' codes and reservations

#### Scenario: Planned use blocks code correction
- **WHEN** a caller with Organization.Manage corrects an effective unit to an unreserved code currently proposed by another planned unit
- **THEN** the system rejects the correction to preserve tenant code uniqueness

### Requirement: Effective Organization business state
Each Organizational Unit SHALL resolve to at most one complete business state on a supplied calendar date. A state SHALL contain name, type, parent placement, and lifecycle state; identity, tenant ownership, and ordinary business code SHALL not be ordinary effective-dated attributes. The system SHALL use calendar-date granularity and SHALL resolve same-date legitimate changes into one resulting state.

#### Scenario: As-of state boundary
- **WHEN** a successor state begins on date D
- **THEN** the predecessor is not resolved on D and the successor is resolved on D

#### Scenario: Same-date changes
- **WHEN** compatible changes to the same unit share an effective date
- **THEN** the system stores/resolves one resulting state for that date rather than parallel same-day states

### Requirement: One permanent root and valid official hierarchy
Before any root identity exists, a tenant MAY have zero Organizational Units. Once Organization root identity is created, a tenant SHALL have one permanent root Organizational Unit identity even if its first effective date is future. The root SHALL have no parent, the built-in Organization type, and SHALL not be moved, reparented, type-changed, cancelled, or inactivated. Before the root's first effective date, the active hierarchy SHALL validly resolve to zero active units and zero active roots. From the root's first effective date onward, active units SHALL resolve to one connected, acyclic tree with exactly one root and exactly one active same-tenant parent for every active non-root. Once effective, the root SHALL not disappear from the active hierarchy.

#### Scenario: Second root rejected
- **WHEN** a tenant already has a root identity, including one scheduled for future effectiveness
- **THEN** a request to create another root is rejected

#### Scenario: Scheduled root leaves today validly empty
- **WHEN** a tenant has one permanent root identity whose first effective date is in the future and hierarchy is requested for today
- **THEN** the result contains zero active units and zero active roots
- **AND** the result is valid but Organization readiness is not Ready

#### Scenario: Cycle or orphan rejected on effective date
- **WHEN** an operation would make a unit its own ancestor, leave an active non-root without an active parent, or attach it across tenants at its effective date
- **THEN** the system rejects the operation and preserves the valid hierarchy

### Requirement: Organization Unit Type vocabulary
The system SHALL provide immutable global built-in types Organization, Business Unit, Division, Department, Team, and Unit. Each effective Organizational Unit state SHALL reference exactly one type. Tenants MAY create tenant-owned custom types whose display names are unique across the tenant's resolved vocabulary, including global built-in names; custom types may be renamed but SHALL remain resolvable while historical or scheduled state references them. Types SHALL remain classification-only and SHALL NOT impose hierarchy grammar or behavior.

#### Scenario: Neutral Unit type
- **WHEN** a tenant creates a unit using the built-in Unit type
- **THEN** the unit is valid without additional taxonomy configuration

#### Scenario: Used custom type deletion denied
- **WHEN** a custom type is referenced by any historical, current, or future effective state
- **THEN** deletion is rejected and the type remains resolvable

#### Scenario: Built-in name cannot be duplicated
- **WHEN** a caller creates or renames a tenant custom type to Department
- **THEN** the system rejects the duplicate vocabulary name
