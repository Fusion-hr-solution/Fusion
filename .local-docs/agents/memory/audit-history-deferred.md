---
name: audit-history-deferred
description: Platform/tenant change-history UI is deferred until a unified Performance+Core audit integration
metadata: 
  node_type: memory
  type: project
  originSessionId: edabf871-8d2b-4701-89c0-c3c6d9ee3fdb
---

Platform Defaults change-history (and tenant configuration history) UI is **deferred** until a unified
audit integration spanning Performance + Core is built later. Decision made 2026-07-01.

**Why:** history/audit should be one coherent cross-module surface, not a per-feature bolt-on. Building
it piecemeal in Platform Defaults now would drift from the eventual unified audit.

**How to apply:** internal versioning + append-only audit records are still written (baseline versions
supersede/history, `PerformanceConfigurationAuditEntry`). The Platform Defaults "History" button remains
but its end-to-end verification (P1.1 task 12.3) is out of scope for P1.1 acceptance. Revisit the history
UI when the Performance+Core audit integration is scoped. Relates to performance-packet-a (archived).
