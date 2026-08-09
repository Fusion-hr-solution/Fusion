## ADDED Requirements

### Requirement: One canonical Organization authority
Core HR SHALL retain exactly one authoritative Organization truth: the stable Organizational Unit identities and their effective states. `DraftOrgUnit`, Draft Structure, draft import, and TenantSetup publish/replace workflows SHALL NOT create, overwrite, deactivate, or otherwise replace canonical Organization state.

#### Scenario: Draft publish cannot replace Organization
- **WHEN** a legacy Draft Structure publish/reopen/replace path is invoked after this change
- **THEN** it cannot mutate canonical Organization truth

### Requirement: Disposable development-data transition
The implementation SHALL use a clean-slate development migration/reset posture for obsolete mutable OrgUnit, Draft Structure, published-structure, and setup-governance data. It SHALL not invent historical effective states or retain duplicate-name/replace semantics merely to preserve development contents.

#### Scenario: Recreated development database
- **WHEN** a development database is recreated for this change
- **THEN** the canonical Organization schema is present without requiring migration of old draft/live structure contents

### Requirement: Bounded temporary compatibility
Any compatibility retained before Change 2 SHALL be read-only or a forwarding adapter to canonical Organization commands, SHALL be marked as temporary, and SHALL name `deliver-organization-workspace` as its removal owner. Compatibility SHALL NOT retain a mutable draft model, a publish authority, or an alternate Organization query truth.

#### Scenario: Legacy read adapter
- **WHEN** a temporary legacy OrgUnit read endpoint remains for the old frontend
- **THEN** it projects only canonical current Organization truth and cannot return a divergent draft/published structure
