---
name: perf-cycle-goals-proposed
description: "OpenSpec change establish-performance-cycle-and-goals — first real Performance feature, PROPOSED only (not implemented)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5c228d77-dc5f-4bb2-816c-7645ec01bfc0
  modified: 2026-08-20T12:28:51.434Z
---

**establish-performance-cycle-and-goals** — OpenSpec change PROPOSED 2026-08-20 (proposal+design+specs+tasks all strict-valid; **not implemented**, no code/migrations). First real Performance feature after the security-only `performance-foundation` host. Lives in gitignored `openspec/changes/establish-performance-cycle-and-goals/` (openspec/ is `.gitignore:120` — local-only, like `.local-docs/`).

**Authorities** (precedence): business=`.local-docs/specs/performance/performance-cycle/product-spec.md` (v1.3) wins; experience=`ui-ux-spec.md` (v1.0) wins unless it breaks business truth; roadmap for boundaries; brownfield-exploration + contract-readiness-audit for auth/integration; DESIGN.md §33/§34 binding. Retired Performance impls are NOT authority.

**Delivery = 4 vertical chunks** (each ships domain+persistence+API+authz+frontend+states+tests+rendered QA+demo together; backend-first rejected): A setup→activation (ends Active), B organizational goals + Alignment Map, C employee plans + Manager Decision, D progress + Contribution Explorer.

**Key locked design decisions:** 4-permission catalogue (`performance.cycle.view` Self/DirectReports/OrgUnit/Tenant, `performance.cycle.manage` Tenant, `performance.strategy.publish` Tenant, `performance.objective.self.manage` Self) — refined from brownfield's 5 by folding named-detail into cycle.view scope + contextual responsibility (aggregate=scope alone; named=scope+manager/accountability); scope=breadth not resource id, `@OrgUnit` grants left UNSEEDED (no Core OrgUnit-leader); org-objective creation = entitlement + (cycle.manage | parent-accountable | strategy.publish for tier 1); **org-objective APPROVAL = parent-accountable only, NO tenant-admin override** (exceptional path is employee-plans only); strategy.publish separate; population resolved fully via internal snapshot contract + one additive Core "all-active as-of" endpoint (adopted); caller from `employee_id` claim (no `/workforce/me`); one `Objective` aggregate for all 3 scopes; one-plan-per-participant invariant; evidence = bounded module-local store. **10 new capability specs** (incl. `performance-objective-measurement` for date rules/3 methods/formulas/immutability/reversible completion) + MODIFIED `performance-foundation`.

**Correction pass applied** (from a ChatGPT review): added measurement capability, removed org-approval admin override, added plan-uniqueness, adopted Core all-active endpoint, dropped `/workforce/me`, clarified @OrgUnit breadth, +population patterns in external-ref task. **Open (design/apply):** external-ref findings (Population Lens/Alignment Map/Plan Composer); demo tenant seed identity. Resume via `/opsx:apply` — Chunk A only, not A–D in one session. Contributes to empty `ModulePermissionContribution(Performance)` stub (`SharedKernel/Auth/ModulePermissionContribution.cs:77-79`). Related: performance-packet-a (archived) (retired legacy Performance), [[permission-gate-hide-not-deny]], [[ui-no-explanatory-text]].
