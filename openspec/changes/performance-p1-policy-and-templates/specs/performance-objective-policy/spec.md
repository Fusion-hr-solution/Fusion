## ADDED Requirements

### Requirement: Tenant objective policy lifecycle

The system SHALL maintain a per-tenant objective policy with versions following
Draft → Active → Superseded. There MUST be at most one Active version and at most one editable Draft
per tenant. Active and Superseded versions MUST be immutable. Publishing the Draft makes it Active and
supersedes the prior Active version. Discarding a Draft MUST NOT affect the Active version. All
operations require authoritative tenant context and fail closed without it.

#### Scenario: Create a Draft from the Active policy

- **WHEN** a Tenant Admin starts editing the active policy
- **THEN** exactly one Draft version is created from the Active version

#### Scenario: Publish a valid policy Draft

- **WHEN** an authorized Tenant Admin publishes a valid Draft
- **THEN** the Draft becomes Active
- **AND** the prior Active version becomes Superseded
- **AND** an audit entry is written

#### Scenario: Discard preserves the Active policy

- **WHEN** a Tenant Admin discards an unpublished Draft
- **THEN** the Active policy remains unchanged

#### Scenario: Reject unauthorized publication

- **WHEN** a user without policy-management permission attempts publication
- **THEN** access is denied

### Requirement: Policy fields

A tenant objective policy SHALL contain: maximum objectives per employee plan; allowed weighting
values as percentages; manager validation SLA in business days; cascade mode of
`Disabled`, `Optional`, or `Required`; a non-empty combination of measurement types from
{Quantitative, Qualitative}; and attachments set to Enabled or Disabled.

#### Scenario: Policy exposes all required fields

- **WHEN** the active policy is read
- **THEN** it returns objective count, allowed weights, SLA, cascade mode, measurement types, and attachments

### Requirement: Policy validation

Publishing a policy MUST be rejected when: the maximum objective count is below the platform minimum
or above the platform maximum; allowed weight values are empty; any weight is below 1 or above 100;
any weight exceeds platform precision; allowed weights contain duplicates; enabled measurement types
are empty; the manager SLA is outside platform guardrails; the configuration cannot produce a 100%
plan within the maximum objective count; active-template compatibility checks fail; or optimistic
concurrency fails. Validation MUST be server-side and return deterministic error codes.

#### Scenario: Reject empty measurement types

- **WHEN** a Tenant Admin attempts to publish a policy with no enabled measurement types
- **THEN** publication is rejected with a deterministic error

#### Scenario: Reject duplicate or out-of-range weights

- **WHEN** allowed weights contain a duplicate or a value below 1 or above 100
- **THEN** publication is rejected with a deterministic error

### Requirement: Weight feasibility

The policy MUST prove that at least one valid combination of allowed weights can total exactly 100%
without exceeding the maximum objective count. The check MUST be deterministic and server-side.

#### Scenario: Block an impossible weight policy

- **WHEN** allowed weights are {30, 40} and maximum objectives is 2
- **THEN** publication is blocked with a specific explanation that no combination totals 100%

### Requirement: Policy compatibility with active templates

Before publishing, the system MUST inspect active template revisions and block publication when the
proposed policy would make an active template invalid (measurement type disabled, suggested weighting
no longer allowed, or another rule makes the active revision structurally invalid). The result MUST
list affected templates and the conflicting field, and MUST NOT silently modify templates.

#### Scenario: Block policy that conflicts with active templates

- **WHEN** active Quantitative templates exist and a Tenant Admin disables the Quantitative measurement type
- **THEN** publication is blocked
- **AND** the affected templates and conflicting field are listed

### Requirement: Fixed P1 rules and concurrency

The system SHALL enforce the following rules, which are not tenant-configurable: objective title maximum of 150 characters; objective
description maximum of 500 characters; submitted plan total must equal 100%; audit, tenant isolation,
and server-side validation. State-changing policy operations MUST use optimistic concurrency, and a
stale update MUST be rejected with a deterministic conflict response while preserving current server
state. Retrying a successful publication MUST NOT create a duplicate version.

#### Scenario: Reject a stale policy update

- **WHEN** two users edit the same Draft and the second saves a stale version
- **THEN** the update is rejected
- **AND** the current server state is preserved

#### Scenario: Idempotent publication

- **WHEN** a successful publication request is retried
- **THEN** no duplicate policy version is created

### Requirement: Policy history

The system SHALL provide policy history listing version, status, published date, publisher, and a
concise change summary, with full version details available in a dedicated read-only view.

#### Scenario: Read policy history

- **WHEN** an authorized user opens policy history
- **THEN** each version's status, published date, publisher, and change summary are returned
