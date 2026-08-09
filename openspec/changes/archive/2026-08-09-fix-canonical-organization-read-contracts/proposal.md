## Why

Change 1 delivered the canonical Organization model, but its History, Upcoming Changes, and initialization read contracts do not expose enough structured truth for the already-approved Organization workspace. Change 2 correctly identified the defect: the frontend would otherwise parse summaries, reconstruct events with extra reads, or confuse a future root with no root.

## What Changes

- Enrich canonical Organization business History and Upcoming Changes with structured business event kind and before/after context for Created, Renamed, Type changed, Moved, and Inactivated events, including scheduled equivalents where applicable.
- **BREAKING** Correct the affected-unit mapping so unit display name and business code are distinct and accurate in History and Upcoming Changes.
- Exclude technical Correction records from Organization business History while retaining corrected as-of truth and separate audit visibility.
- Add an explicit canonical permanent-root initialization/readiness read contract that distinguishes no root identity, future-effective root identity, and effective root.
- Propagate the corrected contracts through `@repo/api` without creating Change 2 hooks, components, or a parallel frontend history model.
- Add focused service/API/contract regression coverage for structured events, correction semantics, initialization state, authorization, tenant isolation, and serialization.

Non-goals: Organization workspace UI, new persistence/domain architecture, Change 3 routing/readiness work, reporting, workforce changes, or any redesign of effective-dated Organization operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `organization-effective-operations`: Business History exposes structured effective business-event semantics and excludes technical Correction records.
- `organization-queries-and-readiness`: Upcoming Changes and initialization/readiness queries expose complete structured canonical data for the workspace.

## Impact

- **Core HR:** canonical Organization DTOs, read/query service mapping, controller responses, and focused tests.
- **Shared frontend contract:** `@repo/api` Organization types/functions and serialization tests only; no UI hooks or components.
- **Authorization and tenancy:** existing `Organization.View`/`Organization.Manage` and tenant-isolation behavior remain unchanged and are regression-tested.
- **Persistence:** no schema or domain-model change is expected; EF migration work is only reconsidered if implementation proves a concrete necessity.
