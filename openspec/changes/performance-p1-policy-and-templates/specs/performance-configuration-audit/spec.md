## ADDED Requirements

### Requirement: Append-only configuration audit coverage

The system SHALL record append-only audit entries for platform and tenant configuration operations.
Platform audit MUST cover guardrail Draft creation, guardrail modification, guardrail publication,
baseline Draft creation, baseline publication, and starter-template creation, activation, revision,
and archive. Tenant policy audit MUST cover policy Draft creation, modification, publication,
supersession, and discard. Category audit MUST cover creation, rename, code change where permitted,
archive, and reactivation. Template audit MUST cover creation, Draft update, revision activation,
prior-revision supersession, duplication, archive, reactivation where supported, and hard deletion of
unused Drafts. Audit entries MUST NOT be modifiable or deletable.

#### Scenario: Policy publication is audited

- **WHEN** a Tenant Admin publishes a policy version
- **THEN** an audit entry recording the publication is appended

#### Scenario: Template lifecycle is audited

- **WHEN** a template is created, a revision is activated, or a template is archived
- **THEN** a corresponding audit entry is appended for each operation

#### Scenario: Audit is append-only

- **WHEN** any actor attempts to modify or delete an existing audit entry
- **THEN** the operation is rejected

### Requirement: Audit entry fields

Each audit entry MUST include scope (platform or tenant), the tenant when applicable, the actor, the
action, the entity type, the entity identifier, the revision or policy version, a timestamp, concise
previous and new values, a reason where required, and a correlation identifier.

#### Scenario: Audit entry captures required fields

- **WHEN** an audited configuration operation completes
- **THEN** the appended entry includes scope, actor, action, entity type and identifier, version, timestamp, change summary, and correlation identifier

### Requirement: Configuration audit access is authorized and scope-separated

Viewing configuration audit MUST require the configuration-audit view capability. Platform audit MUST
NOT be exposed through tenant endpoints, and tenant audit MUST NOT be exposed through platform
endpoints.

#### Scenario: Deny unauthorized audit access

- **WHEN** a user without the configuration-audit view capability requests audit history
- **THEN** access is denied

#### Scenario: Tenant audit scoped to its tenant

- **WHEN** an authorized tenant user views configuration audit
- **THEN** only that tenant's audit entries are returned
