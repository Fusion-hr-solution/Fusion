# B-053 — Performance evidence retention and production storage gate

## Decision

Each tenant has a stored evidence-retention setting in Performance Settings. New and existing settings default to **36 months after Cycle close**. This is a product default, not a legal standard. Administrators may change it; the setting does not block setup or upload.

Retention covers uploaded files only. Keep files while the Cycle is active. On expiry, delete the file and identifying file metadata, while preserving the progress update and a neutral “Attachment removed under retention policy” marker. Enforce expiry on download before cleanup runs. Policy changes apply to already-closed Cycles and may make files immediately eligible. Links and short references remain in the progress record. Keep the current 24-hour sweep for unclaimed uploads.

Use the existing tenant-scoped Performance Settings API and `IPerformanceEvidenceStore`. The local filesystem store is Development-only. The production provider is undecided; production remains gated on a private shared object store, tested backup and restore, and malware scanning before files can be served. Restored backups must not make expired files accessible.

## Implementation

- Extend the existing Cycle Settings DTO, update request, database model and migration with `evidenceRetentionMonths` (positive whole months; default 36).
- Preserve current administrator authorization, optimistic version checks, audit behavior and tenant scoping.
- Expire closed-cycle evidence in the hourly sweeper, delete associated staged-upload records, and retry failed storage deletion on a later sweep.
- Deny expired downloads immediately, even if physical deletion is pending.
- Keep progress updates and render a neutral removal marker after file metadata is cleared.
- Do not select or integrate a provider in this change.

## Verification

- Performance relational suite, including migration Up/Down; evidence API journey through the gateway.
- `@repo/api` and Performance type-checks; Performance lint and tests.
- Verify tenant defaults/isolation, admin authorization, audit/version behavior, positive-month validation, active-cycle preservation, expiry boundaries, retroactive shortening, download denial, deletion retry, and unchanged 24-hour orphan cleanup.
- Run the security-review skill on changed authorization, tenant and file-handling paths.

## Manual review

In Performance Settings, review the “Uploaded evidence” retention row, its 36-month default, and the explanation that changing the value also affects closed Cycles. Confirm the copy is clear and the numeric control fits the existing settings layout.

## Research basis

Official guidance does not establish one universal employment-record retention period. The 36-month value is a configurable product default, not legal advice. See [ICO employment records guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/employment-practices-and-data-protection-keeping-employment-records/collecting-and-keeping-employment-records/) and [GDPR Article 5](https://eur-lex.europa.eu/eli/reg/2016/679/). The production gate follows [NIST SP 800-88 Rev. 2](https://csrc.nist.gov/pubs/sp/800/88/r2/final) and the [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
