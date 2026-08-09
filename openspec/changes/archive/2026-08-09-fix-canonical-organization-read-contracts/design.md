## Context

The archived Change 1 model already stores the information needed to correct the query contract: each non-cancelled Organization operation has a stable identity, effective date, operation kind, and a typed patch in `PayloadJson`; effective-state rows retain resolved name/type/parent/lifecycle truth. The current `OrganizationChangeDto` collapses that information into a generic operation kind and summary, maps History's unit name incorrectly, and returns Correction as a business event. `OrganizationReadinessDto` also reports only a Boolean/reason, so a client cannot distinguish no root from a future-effective root.

Change 2's conformance gate requires this correction before the Organization workspace consumes these reads. No workspace code belongs here.

## Goals / Non-Goals

**Goals:**

- Add a typed business-event projection for History and Upcoming Changes with operation identity retained for cancellation.
- Batch-resolve before/after event context from canonical operations and effective-state/type data, without client parsing or per-event API calls.
- Keep Correction audit-visible but exclude it from business History while allowing corrected historical as-of state to resolve normally.
- Enrich canonical readiness with permanent-root identity, first effective date, and current effectiveness.
- Propagate the exact JSON contract through `@repo/api` and test it.

**Non-Goals:**

- Change the effective-state, operation, audit, authorization, or tenancy architecture.
- Add a migration, event store, UI hook/component, or Change 3 routing behavior.
- Expose raw correction/audit records through Organization business History.

## Decisions

### 1. Separate business semantics from operation semantics in one DTO

Keep `OrganizationChangeKind` as the stable operation/cancellation discriminator. Add a `BusinessEventKinds` collection and typed nullable `Before`/`After` context to `OrganizationChangeDto`. A single ordinary Change can legitimately alter both name and type, so a collection avoids a lossy synthetic `Updated` kind while retaining one stable operation ID. Create, Move, and Inactivate each expose their corresponding semantic kind; Correction and code-only Correction do not produce business-event kinds.

`Before`/`After` contain the affected unit's name, type reference, parent reference (identity, display name, and code), and lifecycle where available. A concise summary remains derived convenience only.

Alternative: expose only a single enum. Rejected because a same-date ordinary Change can be both Rename and Type changed. Alternative: make the frontend infer semantics from the patch/summary. Rejected by the locked contract and creates parsing/N+1 risks.

### 2. Build projections in bulk from canonical operations

The query service loads the tenant's non-cancelled Organization operations plus the needed state/type/parent data in bounded set queries, groups operations by unit, and replays their date/creation ordering in memory. Correction patches participate in reconstruction so later/history context reflects repaired truth, but Correction and code-only correction operations are omitted from business-History output. Upcoming Changes filters the same projection to future effective operations and preserves each operation ID.

This uses the existing JSON patch as an internal implementation detail and does not add a persistence table. It prevents a client-side parser and avoids a per-event lookup pattern.

Alternative: add denormalized before/after columns. Rejected because existing canonical operations and effective state provide the needed data and no concrete persistence deficiency exists.

### 3. Enrich readiness rather than add a parallel initialization endpoint

Extend `OrganizationReadinessDto` with permanent-root existence, identity, first effective date, and current effectiveness. The existing readiness endpoint remains the single canonical initialization/readiness read and lets Change 2 decide whether root creation is allowed without scheduled-operation reconstruction.

Alternative: add a separate initialization endpoint. Rejected because it duplicates the readiness query and risks divergent root status.

### 4. Preserve existing security boundaries

History, Upcoming Changes, and enriched readiness remain `Organization.View` reads and retain the existing CoreHR tenant query filters and controller policy checks. Tests verify no new disclosure or authorization path is introduced.

## Risks / Trade-offs

- [Replay projection diverges from state normalization] → reuse the canonical operation patch semantics and assert event context against corrected as-of state in focused tests.
- [Same-date composite Change has more than one meaning] → expose an ordered semantic-kind collection rather than flattening it.
- [Root metadata could be misread as readiness] → include current root effectiveness and derived `IsReady` together in one DTO.
- [Larger history reads] → use tenant-scoped bulk queries and keep the projection limited to the requested unit's event stream plus referenced parent/type context.

## Migration Plan

1. Update CoreHR DTOs and read projection code without changing persistence.
2. Update controller contract tests and `@repo/api` interfaces/serialization tests.
3. Run focused and full relevant verification, then archive the corrective change.

Rollback is a source rollback; no database migration or data conversion is required.

## Open Questions

None. The archived Change 1 contract and Change 2 conformance gate define the correction boundary.
