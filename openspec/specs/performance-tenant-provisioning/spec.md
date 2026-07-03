# performance-tenant-provisioning Specification

## Purpose

Defines explicit, idempotent tenant provisioning from the current platform standard setup into
tenant-owned Performance policy state.

## Requirements

### Requirement: Explicit new-tenant provisioning from the current standard setup

When a tenant is provisioned, the system SHALL copy the current platform standard setup into an
independent tenant-owned Active objective policy, record the originating platform state, and leave
the tenant-owned template library empty. Provisioning MUST be triggered explicitly during tenant
creation and MUST NOT occur as a side effect of any read operation.

#### Scenario: Provision a tenant from the current standard setup

- **WHEN** a new tenant is provisioned and a current platform standard setup exists
- **THEN** an independent tenant-owned Active policy is created
- **AND** its source platform state is recorded
- **AND** no objective templates are copied from platform scope

#### Scenario: No initialization on read

- **WHEN** a tenant with no provisioned policy reads its objective policy
- **THEN** the read returns an explicit not-provisioned state without creating any policy

### Requirement: Provisioning is idempotent

Provisioning a tenant MUST be idempotent. A repeated provisioning request for a tenant that already
has an objective policy MUST be a safe no-op that returns the existing policy and MUST NOT create a
duplicate policy or duplicate template records.

#### Scenario: Repeated provisioning is a no-op

- **WHEN** provisioning is invoked again for an already-provisioned tenant
- **THEN** no duplicate policy or templates are created
- **AND** the existing tenant policy is returned

### Requirement: Existing tenants are never silently mutated

Applying a new platform standard setup SHALL affect only future tenant provisioning and MUST NOT
automatically alter existing tenant policies or templates. Tenant records are independently owned by
the tenant, and future platform changes MUST NOT mutate them.

#### Scenario: Platform standard-setup Apply does not overwrite tenants

- **WHEN** a Platform Admin applies a new standard setup while tenants have active policies
- **THEN** existing tenant policies remain unchanged

#### Scenario: Existing-tenant migration repair is explicit

- **WHEN** a migration initializes a policy for an existing tenant with migrated legacy templates
- **THEN** it uses the locked P1.1 standard setup once as migration repair
- **AND** runtime reads still do not create or mutate policy state

### Requirement: Provisioning failure is explicit and recoverable

Provisioning SHALL fail safely without leaving partial state. A provisioning call that fails MUST NOT
create a half-written or partially-published tenant policy; it MUST leave the tenant in an explicit
not-provisioned state that a subsequent read reports accurately. Because provisioning is idempotent, a
failed attempt MUST be safely retryable. Provisioning MUST NOT occur when no current platform standard
setup exists; instead the call MUST report an explicit unavailable-baseline condition rather than
provisioning an empty or zeroed policy.

#### Scenario: Failed provisioning leaves an explicit not-provisioned state

- **WHEN** a provisioning call fails partway
- **THEN** no partial tenant policy is created
- **AND** a subsequent read reports an explicit not-provisioned state

#### Scenario: Retry after failure yields exactly one policy

- **WHEN** provisioning is retried after an earlier failed attempt
- **THEN** exactly one Active policy exists and no duplicates are created

#### Scenario: Provisioning without a current standard setup is reported, not faked

- **WHEN** provisioning is invoked while no current platform standard setup exists
- **THEN** an explicit unavailable-baseline condition is reported
- **AND** no empty or zeroed policy is provisioned
