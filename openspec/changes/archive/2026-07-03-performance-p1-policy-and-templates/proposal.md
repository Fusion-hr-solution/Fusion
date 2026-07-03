# Performance P1.1 - Policy and Objective Templates Rebaseline

## Why

The authoritative product target for P1.1 now lives in
`.local-docs/Performance/P1/P1.1/performance-p1.1-policy-and-objective-templates-specification.md`.
The active OpenSpec change, the main capability specs, and parts of the implementation drifted away
from that target. That drift is now the problem to solve.

This change keeps `performance-p1-policy-and-templates` as the single active P1.1 change and
re-baselines it around the local authority spec so OpenSpec can be trusted again for incremental
delivery, verification, and remaining work tracking.

## What Changes

- Rebaseline the active P1.1 OpenSpec change so it explicitly follows the local P1.1 authority spec.
- Preserve locked decisions instead of reopening them:
  - Platform Defaults is a quiet settings surface with one decisive Apply and no surfaced Draft flow.
  - Platform Defaults affects future tenant provisioning only.
  - Platform Admin does not own tenant template content.
  - New-tenant provisioning copies policy only; no platform starter-template pack exists in P1.1.
  - Generic cross-product audit browsing is deferred; append-only lifecycle records remain required.
- Reopen drift where OpenSpec or implementation no longer matches the authority spec:
  - tenant objective policy must read as current policy -> edit locally -> review and apply, not a
    resumable Draft workflow;
  - user-facing history must stay minimal and purpose-specific;
  - template applicability and discovery must match the MVP contract, with optional extensions
    treated as extensions rather than completion requirements.
- Keep this change active after sync so remaining rework and verification continue to be tracked in
  one place.

## Capabilities

### Modified Capabilities

- `performance-platform-defaults`: reaffirm the locked no-Draft Apply model, truthful load states,
  impact-before-mutation, and deferred platform history browser.
- `performance-objective-policy`: realign policy behavior to current policy, local edits, review,
  and Apply; retain immutable applied versions and minimal version history.
- `performance-objective-templates`: keep the tenant-owned template and revision model, but tighten
  applicability and discovery to the authoritative MVP contract.
- `performance-configuration-audit`: reduce P1.1 to append-only lifecycle records plus the minimal,
  scope-separated history surfaces required now; defer a generic audit browser.
- `performance-tenant-provisioning`: preserve policy-only provisioning from the current platform
  standard setup, explicit failure states, and idempotent retry behavior.

## Impact

- OpenSpec artifacts become trustworthy again without archiving the active change.
- Locked work that still matches the authority spec stays closed.
- Drifted work becomes explicit rework instead of silently redefining the target.
- Remaining P1.1 execution can continue slice by slice from `tasks.md` with the local authority spec
  as the governing product source.
