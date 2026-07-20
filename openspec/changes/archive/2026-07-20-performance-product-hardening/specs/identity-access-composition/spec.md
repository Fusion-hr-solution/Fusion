## ADDED Requirements

### Requirement: Every module permission key has exactly one catalog definition

The permission catalog SHALL be internally consistent: every permission key listed in a module's `*.All` set MUST have exactly one matching `CorePermissionDefinition` in `CorePermissionCatalog`, and every `CorePermissionDefinition` MUST correspond to a declared permission key. This invariant SHALL be enforced by an automated test so that adding a permission constant without a definition (or vice-versa) fails the build rather than reaching runtime.

Rationale: access-token generation resolves each granted permission through the catalog; a permission present in `*.All` (and therefore grantable/seedable) but missing from the catalog causes token generation to fail for any tenant holding that grant.

#### Scenario: A permission key without a catalog definition fails the invariant test
- **WHEN** a permission key exists in any module's `*.All` set but has no `CorePermissionCatalog` definition
- **THEN** the catalog-completeness test fails, naming the offending key

#### Scenario: A catalog definition without a declared permission key fails the invariant test
- **WHEN** a `CorePermissionDefinition` exists whose key is not present in any module's `*.All` set
- **THEN** the catalog-completeness test fails, naming the orphaned definition

#### Scenario: Granting a catalog-complete permission generates a token
- **WHEN** a tenant grants a permission that is present in both its module `*.All` set and the catalog
- **THEN** access-token generation succeeds for a principal holding that grant

### Requirement: The permission catalog contains no permissions for removed capabilities

The Performance permission set SHALL NOT declare, catalog, or seed permissions for capabilities that do not exist in the product. Permissions for the removed Packet-A surface — anonymous feedback, formal review, and exception-case management — MUST be absent from `PerformancePermissions`, from `PerformancePermissions.All`, from `CorePermissionCatalog`, and from every role template in `AccessProfileTemplates`.

#### Scenario: Removed-feature permissions are absent from the catalog
- **WHEN** the permission catalog is enumerated
- **THEN** no key matches `performance.feedback.*`, `performance.review.*`, or `performance.exception.*`

#### Scenario: Role templates seed no removed-feature permissions
- **WHEN** a tenant is provisioned from the default access-profile templates
- **THEN** no seeded grant references a feedback, review, or exception permission

#### Scenario: The dormant progress-correction permission is retained
- **WHEN** the permission catalog is enumerated
- **THEN** `performance.objective.progress.correct` remains defined (intentionally dormant, reserved for a later manager-correction capability)
