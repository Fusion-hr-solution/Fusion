## Why

Core HR currently has a mutable live `OrgUnit` tree alongside a separate Draft Structure that can publish/replace that tree. Neither model can express Feature 4's single, effective-dated official Organization truth, so the locked Organization contract cannot be safely delivered on top of the current foundation.

This change establishes that trusted backend capability before the Organization workspace and tenant-readiness routing changes consume it.

## What Changes

- **BREAKING** Replace the non-temporal, mutable `OrgUnit` shape with a stable tenant-owned Organizational Unit identity and effective business-state model. Names become repeatable; business codes are tenant-unique for proposed and effective units, permanently reserved after first effectiveness, and correctable only through an audited exceptional path.
- Establish one permanent root identity per initialized tenant. Before its first effective date the active Organization hierarchy is validly empty; from that date the official hierarchy is a connected, acyclic tree with exactly one active root. Root type, parent, movement, and retirement invariants are enforced server-side.
- Add canonical effective-dated Organization commands for root/unit creation, descriptive/type change, dedicated subtree Move, terminal inactivation, safe cancellation of individually addressable never-effective future operations, Correction, and business-code correction.
- Add built-in Organization Unit Types plus tenant custom types, with historical resolvability, built-in/custom vocabulary-name uniqueness, and safe deletion rules.
- Add tenant-scoped Organization API/query contracts for as-of hierarchy, detail, Chart/Outline structural data, duplicate-name-safe search, business history, upcoming changes, readiness, and all Change 2 mutation flows. No visual workspace is introduced.
- **BREAKING** Replace `Structure.View` / `Structure.Manage` / `Structure.Publish` enforcement with deny-by-default tenant-scoped `Organization.View` and `Organization.Manage`; remove residual role gates and the publish capability. Tenant Administrator receives both grants.
- **BREAKING** Neutralize the competing Draft Structure/publish-replace authority. Any compatibility retained until Change 2 is read-only or forwarding-only, explicitly temporary, and cannot create or replace canonical Organization truth.
- Preserve `WorkAssignment.OrgUnitId` as the stable identity contract: structural changes alter ancestry, never an assignment's referenced unit id.
- **BREAKING** Remove `ResponsibleManagerEmployeeId` from canonical Organizational Unit structural state and Organization contracts. This change does not substitute an organization-responsibility model; the obsolete capability/spec is retired after confirming no active runtime consumer.
- Treat existing development/demo organization data as disposable: recreate/reset development databases rather than adding production-style migration complexity to preserve obsolete draft/publish or mutable-tree data.

Non-goals: the `/core/organization` workspace, Chart/Outline rendering and drag/drop UI, Getting Started and post-login routing, navigation convergence, Organization Structure Import, Reporting internals, People/Work Assignment redesign, employee reporting hierarchy, granular organization scopes, and a replacement responsibility feature.

## Capabilities

### New Capabilities

- `canonical-organization-model`: Stable Organizational Unit identity, permanent tenant root, type vocabulary, effective business state, business-code semantics, and lifecycle invariants.
- `organization-effective-operations`: Stable scheduled-operation identity, Change, Correction, dedicated subtree Move, inactivation, individual cancellation, concurrency, hierarchy validation, and human-readable business history.
- `organization-queries-and-readiness`: Tenant-scoped as-of Organization query/API contracts, search/disambiguation, upcoming changes, and derived Organization readiness for the future workspace.
- `organization-authorization`: Capability-based tenant Organization access with `Organization.View` and `Organization.Manage` grants and enforcement.
- `organization-brownfield-reconciliation`: Removal/containment of draft-publish competing authority and the disposable-development-data transition to the canonical model.

### Modified Capabilities

- `workforce-canonical-model`: A Work Assignment's Organizational Unit reference is explicitly a stable canonical Organization identity across Organization effective-dated changes.
- `org-unit-responsible-manager`: Retire the obsolete structural responsible-manager attribute and its Organization exposure; no replacement responsibility model is introduced in this change.

## Impact

- **Core HR backend:** Organizational Unit domain/persistence/migrations, commands, queries, controllers, validation, concurrency, tenant isolation, history, and tests.
- **Shared/Identity authorization:** Core permission catalog, policy service, and seeded Tenant Administrator grants. Platform Administrator remains outside tenant Organization authority.
- **Contracts:** replace existing `api/corehr/org-units`, draft-structure, and tenant-settings Organization contracts with canonical Organization contracts required by Change 2; temporary adapters, if needed, are bounded to Change 2 removal.
- **Brownfield reconciliation:** DraftStructure/TenantSetup publish-replace governance and `Structure.Publish` cannot remain an alternate authority. Development databases may be recreated/reset; no legacy live/draft data migration is required.
- **Legitimate consumers:** preserve the stable `WorkAssignment.OrgUnitId` identity reference and remove legacy `ResponsibleManagerEmployeeId` only after active consumers and obsolete tests/contracts are reconciled.
