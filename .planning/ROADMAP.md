# Roadmap — Fusion Performance Packet A (Governed Campaign Foundation)

**Granularity:** standard · **Phase ID convention:** sequential
**Success metric:** FULL SPEC PARITY — every v1 requirement implemented AND verified;
builds clean, xUnit passes, EF migrations consistent.

**Brownfield posture:** much of Packet A already exists (builds clean, 80 tests pass).
Each phase is tagged **VERIFY** (audit existing slices against spec), **BUILD** (known
gap), or **VERIFY + BUILD** (mostly exists, finish the gap). The whole milestone is
**one cohesive cross-service pass** (DEC-single-cohesive-implementation-pass), not a
foundation-only release.

## Phases

- [x] **Phase 1: Foundation Contract Verification** - Verify the Core/Identity foundations Packet A consumes (effective-dated workforce, eligibility, migration) and confirm migrations are consistent.
- [x] **Phase 2: Campaign Lifecycle & Snapshot Verification** - Verify lifecycle, population, launch snapshot, assignment matrix, governance, audit, and notifications against the 16-requirement spec. (completed 2026-06-22)
- [x] **Phase 3: Objective Cascade Completion** - Verify the individual cascade; build strategic publishing, team-objective + superior-approval routing, and milestone/progress endpoints. (completed 2026-06-23)
- [ ] **Phase 4: Peer/Upward Feedback** - Build narrative feedback responses with anonymity/visibility and the minimum-response threshold (default 3).
- [ ] **Phase 5: Exception Resolution & Parity Hardening** - Build exception-owner resolution handlers; close all remaining gaps; full tenant fail-closed test coverage and clean-build/migration verification.

## Phase Details

### Phase 1: Foundation Contract Verification

**Goal**: Confirm the minimum Core + Identity foundation Packet A genuinely requires is
correct and authoritative, so Performance builds against trustworthy contracts — no
shadow workforce model, no duplicated authorization.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-core-effective-dated-foundation, REQ-migration
**Mode**: VERIFY (audit existing working-tree foundation; build only corrections)
**Success Criteria** (what must be TRUE):

  1. The effective-dated Core workforce contract (positions, assignments, memberships,
     typed primary/secondary reporting) is reachable from Performance via
     `CoreWorkforceClient` with bearer-token forwarding, and one active primary manager
     per active employment context is enforced (verified by test).

  2. Core does not infer positions from job-title strings, and reporting-relationship
     validation (cycles, self-management, conflicting date ranges, inactive references,
     provenance) holds.

  3. Identity internal eligibility evaluation answers Performance's authorization queries
     (deny-by-default) without Performance duplicating authz logic.

  4. All EF migrations across touched services apply deterministically with no pending
     model changes (`dotnet ef migrations has-pending-changes` clean); migration is
     tenant-isolated, rerunnable, idempotent.
**Plans**: 3 plans

- [x] 01-01-PLAN.md — Verify Core effective-dated workforce contract + reporting-relationship validation (cycle/self/overlap, positions-not-from-title, remediation provenance) via tests
- [x] 01-02-PLAN.md — Verify cross-service bearer-token forwarding (CoreWorkforceClient) and Identity deny-by-default eligibility + signed internal-channel negative paths
- [x] 01-03-PLAN.md — Verify EF migration determinism (has-pending-changes clean) and tenant-isolated/idempotent foundation migrations

### Phase 2: Campaign Lifecycle & Snapshot Verification

**Goal**: Confirm the existing campaign engine — lifecycle, population, launch snapshot,
assignment/responsibility matrix, governance freeze, audit, notifications — meets the
spec's explicit acceptance criteria, fixing any divergences found.
**Depends on**: Phase 1
**Requirements**: REQ-campaign-lifecycle, REQ-population-definition, REQ-launch-snapshot, REQ-assignment-generation, REQ-superior-approval-config, REQ-retention-privacy, REQ-audit-history, REQ-notifications
**Mode**: VERIFY (audit existing slices; patch gaps surfaced by the spec checklist)
**Success Criteria** (what must be TRUE):

  1. A campaign moves Draft → AssignmentPreparation → ReadyToLaunch → Active → Closed via
     explicit, audited transitions (no hidden flags); governance config and the
     superior-approval rule are frozen at publish and immutable thereafter.

  2. Population definition (org-based, dynamic-filter, manual inclusion/exclusion,
     controlled-sampling) previews from live Core while drafting and is a step distinct
     from responsibility generation.

  3. Activation freezes a launch snapshot (employee, manager chain, org node,
     reviewer-relevant attributes, rules, deadlines); mid-cycle Core changes surface a
     delta requiring explicit reconciliation and never silently regenerate curated
     assignments.

  4. The assignment/responsibility matrix shows subject/responsibility/assignee/source/
     warnings/readiness with provenance, supports curation with justification for
     material overrides, and validates missing managers, inactive users, scope failures,
     self-approval, cycles, duplicates, conflicts, and overload.

  5. Publication is blocked without a tenant-governed retention policy (snapshotted on
     the campaign) and without ≥1 exception owner; every governed action emits an
     append-only audit event (actor/action/object/time/result/tenant/correlation ID),
     and notifications are responsibility-driven, not population-driven.
**Plans**: 6 plans
**Wave 1**

- [x] 02-01-PLAN.md — Wave 0 demo-spine RED tests: D-03 governed happy path + D-04 guardrails 1/3/4 (freeze, tenant fail-closed, audit emission)
- [x] 02-02-PLAN.md — Wave 0 gap-targeting RED tests: reconciliation, assignment cycle/conflict/overload, CycleActivated/CycleClosed notifications

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Audit schema gap: PerformanceCycleAuditEvent Outcome + CorrelationId + EF migration + correlation plumbing
- [x] 02-04-PLAN.md — Reconciliation build: ApplyWorkforceDelta apply/reject loop, audited per item, no silent regen (D-06/D-07)
- [x] 02-06-PLAN.md — Notification fixes: CycleActivated to assignees + responsibility-driven CycleClosed

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05-PLAN.md — Assignment validation: manager-chain cycle detection + non-blocking overload warning (D-08/D-09)

### Phase 3: Objective Cascade Completion

**Goal**: Make the full three-level governed objective cascade real — verify the existing
individual flow, then build strategic publishing, team-objective creation with
superior-approval routing, and SMART milestone/progress tracking.
**Depends on**: Phase 2
**Requirements**: REQ-objective-cascade, REQ-smart-objectives, REQ-approval-routing,
REQ-formal-review
**Mode**: VERIFY + BUILD
**Success Criteria** (what must be TRUE):

  1. Individual objectives can be created (from catalog template or ad hoc), submitted,
     and approved/rejected/returned by the primary-chain manager, with exceptional
     manager assignment — verified end-to-end with audit.

  2. Top management can publish strategic objectives versioned by period, and managers
     can create team objectives derived from the strategic set.

  3. Team-objective approval routes through the primary management chain only, honoring
     the per-campaign superior-approval rule frozen at publish, with fallback
     delegate → next primary-chain superior → exception owner and no silent secondary
     fallback (every route logged).

  4. SMART objectives support measurable outcomes, weights, comments, due dates,
     milestones, and progress via dedicated milestone/progress-tracking endpoints; no
     OKR toggle is exposed.

  5. Formal reviews run with frozen self/manager templates and an approved rating scale;
     self-review feeds the manager assessment as the accountable, finalized, lockable
     outcome with governed corrections (verified).
**Plans**: 7/7 plans complete

**Wave 1**

- [x] 03-01-PLAN.md — Extend Core workforce contract with org-unit owner/member reads + Performance client consumption; pin manager-chain ordering (D-16)
- [x] 03-02-PLAN.md — BUILD strategic objectives (period-versioned publish + immutable supersession) and stand up all shared phase infra (DbSets, permissions, policy methods, audit actions)
- [x] 03-05-PLAN.md — VERIFY individual cascade: create(catalog+adhoc)/submit/approve/reject/return + exceptional manager assignment + assigned-approver gating (D-17, D-19 #1)
- [x] 03-06-PLAN.md — VERIFY formal reviews: frozen templates + rating scale, self-feeds-manager finalize/lock, governed corrections (REQ-formal-review)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — BUILD collective objectives aligned to strategic + primary-chain superior-approval routing under the frozen rule (D-09/D-10), least-privilege visibility + frozen-alignment guardrails (D-19 #1/#2/#3, D-04)
- [x] 03-04-PLAN.md — BUILD SMART milestone + progress-tracking endpoints: single authoritative mode, append-only history, manager correction with reason + governance audit (D-12/D-13/D-14)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-07-PLAN.md — D-18 keystone end-to-end test: publish strategic → collective aligned + routed approval → individual approval → progress/milestones → formal review self-feeds-manager finalize/lock

### Phase 4: Peer/Upward Feedback

**Goal**: Deliver narrative peer/upward feedback as a privacy-correct, owner-curated
input — the response submission/retrieval that is currently missing.
**Depends on**: Phase 3
**Requirements**: REQ-peer-upward-feedback
**Mode**: BUILD
**Success Criteria** (what must be TRUE):

  1. An invited peer/upward reviewer can submit a narrative feedback response against a
     curated assignment, and authorized consumers can retrieve responses subject to the
     campaign visibility policy.

  2. Feedback is narrative-only (not independently scored); generated candidates remain
     suggestions confirmed by an owner before launch; no "everyone reviews everyone".

  3. Reviewer identity mappings are stored separately from feedback content; campaign
     ownership alone never reveals hidden identities; anonymity/visibility follow the
     per-campaign policy.

  4. A configurable minimum-response threshold (MVP default/minimum = 3) suppresses
     output when anonymity cannot be preserved; validation covers self-feedback,
     duplicates, inactive participants, conflicts, reviewer overload, and insufficient
     anonymity groups; submissions emit audit events.
**Plans**: 3 plans

- [ ] 04-01-PLAN.md — Domain model + enums + EF schema: entities, enums, EF configurations, DbContext, migration
- [ ] 04-02-PLAN.md — Commands + authorization: ConfigureTemplate, Submit, Revise, Withdraw, Invalidate, ResolveIdentity + access policy
- [ ] 04-03-PLAN.md — Queries + controller + tests: GetFeedbackResponses, GetThresholdStatus, FeedbackController, handler tests

### Phase 5: Exception Resolution & Parity Hardening

**Goal**: Let exception owners resolve routed items, close every remaining spec gap, and
prove FULL SPEC PARITY — clean build, all xUnit passing including tenant fail-closed
coverage, consistent migrations.
**Depends on**: Phase 4
**Requirements**: REQ-exception-owner
**Mode**: BUILD + VERIFY (parity gate)
**Success Criteria** (what must be TRUE):

  1. An authorized exception owner can resolve a routed item by reassign, permitted
     override, return, or cancel; exactly one accountable current owner is maintained per
     case, and the failed route, reassignment, override, reason, actor, and timestamp are
     audited.

  2. Exception-resolution actions are deny-by-default policy-gated (permission + org
     scope + resource context + workflow relationship) and emit responsibility-driven
     notifications.

  3. Every v1 requirement has automated test coverage, including tenant fail-closed
     behavior (unresolved/foreign tenant yields no rows / access denied) across the gap
     features.

  4. The full solution builds clean (zero errors), all Performance xUnit tests pass
     (existing + new), and `dotnet ef migrations has-pending-changes` reports no pending
     model changes.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Contract Verification | 3/3 | Complete    | 2026-06-22 |
| 2. Campaign Lifecycle & Snapshot Verification | 6/6 | Complete    | 2026-06-22 |
| 3. Objective Cascade Completion | 7/7 | Complete   | 2026-06-23 |
| 4. Peer/Upward Feedback | 0/3 | Planned | - |
| 5. Exception Resolution & Parity Hardening | 0/0 | Not started | - |
