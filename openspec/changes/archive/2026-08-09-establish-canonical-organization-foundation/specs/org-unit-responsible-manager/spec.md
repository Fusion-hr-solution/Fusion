## REMOVED Requirements

### Requirement: Responsible manager as validated org-administration attribute
**Reason**: The locked Feature 4 Organization model defines canonical structural state as name, type, parent, and lifecycle. `ResponsibleManagerEmployeeId` is neither part of that contract nor a structural invariant, and retaining it on the replacement aggregate would preserve an unrelated workforce responsibility concept without approved semantics.

**Migration**: Remove the field, Organization DTO/API exposure, validation/audit service, and supporting tests as part of the clean-slate development transition. This change introduces no replacement responsibility model.

### Requirement: Responsible manager validation
**Reason**: The direct employee reference is being retired with the structural attribute; its active-employment validation is no longer a canonical Organization responsibility.

**Migration**: Remove the validation path after a repository-wide consumer scan confirms no active runtime dependency; consumers must not fall back to stale OrgUnit data.

### Requirement: Deny-by-default authorization for responsible-manager changes
**Reason**: There will be no responsible-manager mutation on Organizational Units after this change.

**Migration**: Remove the dedicated mutation authorization path; Organization.Manage governs only the locked Organization operations.

### Requirement: Responsible manager exposure
**Reason**: Feature 4 does not define Organization responsibility display or Performance snapshots, and the current repository exploration found no active Performance source consumer.

**Migration**: Remove the user-facing/contract exposure. A later approved workforce responsibility capability may define a new owned contract instead of reviving this field.
