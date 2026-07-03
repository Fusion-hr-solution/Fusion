# performance-configuration-audit Specification

## Purpose

Defines the append-only lifecycle record requirements and the minimal history surfaces that P1.1
needs now, while deferring a generic audit browser to later shared audit work.

## Requirements

### Requirement: Append-only lifecycle records preserve configuration integrity

The system SHALL record append-only lifecycle records for the configuration changes that must remain
traceable in P1.1. Platform records MUST cover successful standard-setup and advanced-limit Apply
operations, blocked advanced-limit Apply attempts, and the resulting immutable applied states. Tenant
records MUST cover objective-policy Apply and supersession, category lifecycle changes, template
revision activation and supersession, duplication, archive or restore, and constrained deletion of
eligible unused Drafts. Lifecycle records MUST NOT be modifiable or deletable.

#### Scenario: Policy Apply is recorded

- **WHEN** a Tenant Admin applies a policy version
- **THEN** a lifecycle record recording the change is appended

#### Scenario: Template lifecycle is recorded

- **WHEN** a template revision is activated, duplicated, archived, or restored
- **THEN** a corresponding lifecycle record is appended for each operation

#### Scenario: Blocked platform-limit Apply is recorded

- **WHEN** a Platform Admin attempts to apply limits that fail impact analysis
- **THEN** a platform lifecycle record records the blocked attempt and concise conflict reason

#### Scenario: Lifecycle records are append-only

- **WHEN** any actor attempts to modify or delete an existing lifecycle record
- **THEN** the operation is rejected

### Requirement: Lifecycle record fields

Each lifecycle record MUST include scope (platform or tenant), the tenant when applicable, the
actor, the action, the entity type, the entity identifier, the relevant version or revision, a
timestamp, concise previous and new values where required for integrity, a reason where required, and
a correlation identifier.

#### Scenario: Lifecycle record captures required fields

- **WHEN** an audited configuration operation completes
- **THEN** the appended record includes scope, actor, action, entity type and identifier, version or revision, timestamp, change summary, and correlation identifier

### Requirement: P1.1 exposes only minimal user-facing history surfaces

P1.1 SHALL expose only the history needed to use the product safely: simple tenant policy version
history, simple template revision history, and concise current or last-updated facts for Platform
Defaults. A generic searchable audit browser, raw event timeline, or broad cross-product audit
experience is not required in P1.1.

#### Scenario: Tenant policy history is minimal

- **WHEN** an authorized user opens policy history
- **THEN** the current and previous versions are shown with concise applied-date and actor metadata

#### Scenario: Template revision history is minimal

- **WHEN** an authorized user opens template revision history
- **THEN** current and prior revisions are shown without requiring a generic audit browser

#### Scenario: Platform Defaults expose concise current-state facts

- **WHEN** a Platform Admin views Platform Defaults
- **THEN** concise current-state or last-updated facts may be shown
- **AND** a dedicated platform audit browser is not required

### Requirement: History access is authorized and scope-separated

History access MUST remain scope-separated and authorized. Platform history facts MUST require
`PlatformRole.PlatformAdmin` and MUST NOT require or consult tenant context. Tenant policy and
template history MUST require the relevant tenant capability and authoritative tenant context, failing
closed without it. Platform history MUST NOT expose tenant business content, and tenant history MUST
NOT expose platform-scope records.

#### Scenario: Platform history requires Platform Admin without tenant context

- **WHEN** an actor requests platform history facts
- **THEN** access requires `PlatformRole.PlatformAdmin`
- **AND** no tenant context is required or consulted

#### Scenario: Tenant history requires tenant capability and context

- **WHEN** an actor requests tenant policy or template history
- **THEN** access requires the relevant tenant capability and an authoritative tenant context
- **AND** the request fails closed without authoritative tenant context
