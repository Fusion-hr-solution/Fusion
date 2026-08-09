## MODIFIED Requirements

### Requirement: Meaningful business history

The system SHALL provide human-readable business history derived from effective-state differences, including Created, Renamed, Type changed, Moved, and Inactivated events. Every business-history item SHALL expose structured business-event kind data and typed before/after context without requiring a client to parse a summary or reconstruct parent/type/name data through additional reads. The context SHALL accurately distinguish affected-unit display name from business code and SHALL include applicable prior/resulting name, type, parent identity/display context, and lifecycle state. Future changes SHALL be identifiable as scheduled. Business history SHALL remain distinct from technical/compliance audit history: Correction and code-only Correction SHALL remain audit-visible but SHALL NOT appear as false business-effective History events, while corrected historical as-of truth SHALL resolve normally.

#### Scenario: Move history context

- **WHEN** a unit is moved from one parent to another
- **THEN** its History item identifies the Moved business event kind, effective date, previous parent identity/display context, and resulting parent identity/display context
- **AND** the client does not parse a raw persistence payload or summary to obtain that meaning

#### Scenario: Rename and type change remain distinct

- **WHEN** an ordinary Change renames a unit, changes its type, or changes both values
- **THEN** History exposes Renamed and/or Type changed as the precise structured business-event kinds
- **AND** each applicable before/after value is present

#### Scenario: Historical Correction is not a business event

- **WHEN** a caller corrects a historical Organization state with a required reason
- **THEN** historical as-of resolution reflects the repaired truth
- **AND** Organization business History contains no Created, Renamed, Type changed, Moved, or Inactivated event created solely by that Correction
- **AND** technical correction evidence remains available through audit mechanisms outside business History
