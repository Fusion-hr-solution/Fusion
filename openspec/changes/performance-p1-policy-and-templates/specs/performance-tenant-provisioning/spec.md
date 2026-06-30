## ADDED Requirements

### Requirement: Explicit new-tenant provisioning from the Published baseline

When a tenant is provisioned, the system SHALL copy the current Published platform baseline into an
independent tenant-owned Active objective policy and record the originating baseline version. Selected
platform starter templates MAY be copied into the tenant library as new tenant-owned records.
Provisioning MUST be triggered explicitly during tenant creation and MUST NOT occur as a side effect
of any read (GET) operation.

#### Scenario: Provision a tenant from the baseline

- **WHEN** a new tenant is provisioned and a Published platform baseline exists
- **THEN** an independent tenant-owned Active policy is created
- **AND** its source baseline version is recorded

#### Scenario: No initialization on read

- **WHEN** a tenant with no provisioned policy reads its objective policy
- **THEN** the read returns an explicit not-provisioned state without creating any policy

### Requirement: Provisioning is idempotent

Provisioning a tenant MUST be idempotent. A repeated provisioning request for a tenant that already
has an objective policy MUST be a safe no-op that returns the existing policy and MUST NOT create a
duplicate policy or duplicate starter-template copies.

#### Scenario: Repeated provisioning is a no-op

- **WHEN** provisioning is invoked again for an already-provisioned tenant
- **THEN** no duplicate policy or templates are created
- **AND** the existing tenant policy is returned

### Requirement: Existing tenants are never silently mutated

Publishing a new platform baseline SHALL affect only future tenant provisioning and MUST NOT
automatically alter existing tenant policies or templates. Copied tenant records become independently
owned by the tenant, and future platform changes MUST NOT mutate those copies.

#### Scenario: Baseline publication does not overwrite tenants

- **WHEN** a Platform Admin publishes a new baseline while tenants have active policies
- **THEN** existing tenant policies remain unchanged
