# org-unit-responsible-manager Specification

## Purpose

Defines `OrgUnit.ResponsibleManagerEmployeeId` as a validated, audited org-administration attribute distinct from reporting relationships, with deny-by-default authorization and clear user-facing exposure.

## Requirements

### Requirement: Responsible manager as validated org-administration attribute

`OrgUnit` SHALL retain `ResponsibleManagerEmployeeId` as an optional, single-per-unit org-administration attribute representing the employee accountable for the organization unit. It SHALL be distinct from employee-to-employee `ManagerRelationship` and SHALL NOT be derived from reporting relationships or manager chains.

#### Scenario: Responsible manager is independent of reporting
- **WHEN** an org unit has a responsible manager
- **THEN** the value is the org unit's accountable employee
- **AND** it is not computed from any employee's manager chain

#### Scenario: Empty org unit may have a responsible manager
- **WHEN** an org unit has no members
- **THEN** it may still have a responsible manager assigned

### Requirement: Responsible manager validation

Setting or updating `OrgUnit.ResponsibleManagerEmployeeId` SHALL validate that the referenced employee is in the same tenant and has active employment. Cross-tenant, inactive, or missing employee references SHALL be rejected. Changes SHALL be audited.

#### Scenario: Same-tenant active employee accepted
- **WHEN** a responsible manager is set to a same-tenant employee with active employment
- **THEN** the assignment is accepted and audited

#### Scenario: Cross-tenant or inactive reference rejected
- **WHEN** a responsible manager is set to an employee in another tenant or without active employment
- **THEN** the system rejects the operation with a validation error

#### Scenario: Responsible manager change is audited
- **WHEN** an org unit's responsible manager changes
- **THEN** a workforce audit entry records the change

### Requirement: Deny-by-default authorization for responsible-manager changes

Setting or changing `OrgUnit.ResponsibleManagerEmployeeId` SHALL enforce server-side, deny-by-default authorization and tenant scoping. A caller without the required org-administration permission SHALL be denied, and SHALL NOT change responsible managers for org units outside their tenant.

#### Scenario: Responsible-manager change denied without permission
- **WHEN** a user without org-administration permission attempts to set or change a responsible manager
- **THEN** the request is denied and the attribute is unchanged

#### Scenario: Responsible-manager change denied across tenants
- **WHEN** a user attempts to change the responsible manager of an org unit in another tenant
- **THEN** the request is denied

### Requirement: Responsible manager exposure

The system SHALL expose the responsible manager as **Responsible manager** in user-facing org-unit screens and SHALL allow Performance to snapshot the resolved value when preparing a campaign. The system SHALL NOT introduce an effective-dated `OrgResponsibility` entity in this milestone.

#### Scenario: Responsible manager labeled in UI
- **WHEN** an org unit is displayed
- **THEN** the responsible manager is labeled **Responsible manager**

#### Scenario: Performance snapshots resolved responsible manager
- **WHEN** Performance prepares a campaign that requires org ownership
- **THEN** it can snapshot the resolved responsible-manager value from Core
