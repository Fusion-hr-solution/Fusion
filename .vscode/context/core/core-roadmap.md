# CoreHR Roadmap

Canonical planning and execution guide for CoreHR.
Last refreshed: 2026-04-21.
Current focus now: Employee Foundation & Import.

This file supersedes [../core-hr-module-roadmap.md](../core-hr-module-roadmap.md) as the main CoreHR roadmap.

## 1. Purpose

- Use this file to understand the real CoreHR product shape, the big milestones that matter, and the current big goal.
- Use the Scrum board for issue tracking, backlog visibility, and progress reporting.
- Use this roadmap for direction, milestone sequencing, decomposition rules, and reconciliation when the board or older docs are stale.
- This file should stay practical. It is an operating document, not a presentation and not a changelog.

## 2. Source of truth and reconciliation rules

- Source-of-truth order for planning decisions:
  1. actual codebase and repo reality
  2. validated behavior from code, tests, and builds
  3. the current roadmap
  4. Scrum board export
  5. older docs and backlog wording
- The Scrum board is a guardrail, not divine truth.
- If the board and the repo disagree, follow the repo and record the reason here.
- Prefer real prerequisites over stale planned order.
- Do not silently drift. Add a short reconciliation note when the roadmap intentionally deviates from the board.

## 3. CoreHR definition and scope

- CoreHR is the tenant’s configurable people foundation and system of record.
- It owns the live organization model, the canonical employee record, bounded tenant-level Core configuration, and the access, audit, and operational rules around that data.
- A tenant should establish a trusted live structure once, operate it safely, and then reuse it across downstream HR capabilities.

### What belongs in CoreHR

- Tenant structure setup and the live organization foundation.
- Canonical employee data and employee-to-structure relationships.
- Bounded tenant configuration and core customization.
- Reporting-line integrity and hierarchy safeguards.
- Structure-aware read experiences such as directory and org chart.
- Access control, audit, and operational controls for CoreHR-owned data.

### What does not belong in CoreHR v1

- Learning or training.
- Recruiting or interview workflows.
- Performance management.
- Broad platform-wide admin operation beyond what CoreHR itself needs.
- Advanced page-builder style customization.
- A giant generic import studio.

## 4. Current product state snapshot

### Delivered and productized now

- Platform-admin organization provisioning and first-admin invite lifecycle exist.
- Tenant-side setup is real and meaningful, not placeholder.
- Setup covers activation, draft structure authoring, readiness review, approval, reopen, publish, and completion.
- Publish completes setup in the normal happy path.
- The setup area remains the completion summary and activity record after completion.
- Draft structure manual CRUD and template-first CSV import exist.
- Live org-unit APIs exist.
- Platform-admin organizations UI exists.

### Implemented but not yet productized

- Employee CRUD, list, and detail APIs exist in backend.
- Tenant settings and configuration APIs exist in backend.
- Core setup gating and locked navigation outside setup exist.
- Configuration capability is stronger in backend than in tenant UX.

### Not yet delivered

- A real tenant employee roster and employee management UX beyond placeholder pages.
- Formal employee-to-org-unit linkage.
- Employee import against trusted live structure.
- Reporting-line integrity workflows beyond the basic manager field.
- Org chart and richer structure-aware people experiences.
- Broad day-two CoreHR tenant operations UX.

### Major constraints and risks

- Frontend slices can drift if existing backend capability, current nav exposure, or shared package affordances are treated as product truth before the slice contract is pinned.
- Older setup planning docs are stale and should not drive new sequencing.
- Placeholder tenant pages do not count as delivered product.
- Multiple unmerged PRs are likely, so branch stack discipline matters.

### Residual setup polish only

- Maybe generate the draft-structure tree on valid import instead of making a later validation step the point where the tree becomes visible.
- Keep this as setup polish only. It is not a reason to reopen setup as the main roadmap track.

## 5. Big milestone map

These milestones are intentionally larger than the current board feature buckets. The board can continue tracking lower-level items inside them.

### 5.1 Tenant Structure Setup & Live Organization Foundation

Status: Effectively done.

- Owns tenant activation into CoreHR, the setup lifecycle, the draft structure workspace, readiness and governance, publish-to-live, and setup completion.
- Owns the trusted live organization structure that later employee and hierarchy work depends on.
- Current repo reality supports treating this as a stable foundation, not the main unfinished track.

### 5.2 Tenant Configuration & Core Customization

Status: Partially done.

- Owns bounded tenant-level CoreHR customization: employee field settings, org-unit kinds, lookup or reference data where relevant, access and sharing rules, and light branding such as logo or theme-level presentation.
- Current repo reality already has backend configuration foundations through tenant settings and draft-structure schema, but tenant-facing management UX is not yet broadly productized.
- Keep this bounded. CoreHR should support practical tenant customization, not become a no-code page builder.

### 5.3 Employee Foundation & Import

Status: Current big goal.

- Owns the canonical employee record, employee management UX, employee-to-structure linkage, and employee import against trusted live structure.
- Current repo reality already has backend employee capability, but productization, linkage, and import are still missing or incomplete.

### 5.4 Reporting Lines & Hierarchy Integrity

Status: Later, dependent.

- Owns manager relationships, reassignment rules, cycle prevention, and hierarchy integrity safeguards.
- This should build on a stable employee foundation and explicit employee-to-structure relationships.

### 5.5 Org Chart & Structure-Aware People Experience

Status: Later, dependent.

- Owns directory, org chart, team or downline views, and related structure-aware read experiences.
- This should sit on top of real employee data, real org-unit linkage, and valid reporting lines.

### 5.6 Core Access, Audit & Operational Controls

Status: Cross-cutting and partially present.

- Owns who can view or change what in CoreHR, auditability of important actions, tenant-safe operational guardrails, and workflow safety around Core-owned data.
- Some parts of this milestone are prerequisite groundwork and must be pulled forward early.
- Broader audit and operational maturity can continue alongside later milestones.

## 6. Current big goal: Employee Foundation & Import

This is the next major CoreHR milestone to move from foundation into real day-two tenant operations.

### Why this is the current big goal

- Setup and live structure are already strong enough to support the next layer.
- Existing employee backend capability should be productized before inventing unrelated net-new capability.
- Employee-to-structure linkage is the prerequisite for meaningful import, hierarchy safety, directory, and org chart work.

### High-level decomposition of this goal

1. Pull forward prerequisite groundwork from Core Access, Audit & Operational Controls when needed.
   - First example: harden employee write authorization and tenant-safe write rules before expanding employee write UX.
2. Productize employee management on top of existing backend capability.
   - Employee roster, detail, create or edit, and search or filter UX.
3. Add structural integration.
   - Formal employee-to-org-unit linkage and movement away from loose department-string dependence.
4. Deliver employee import against trusted live structure.
   - Validation, preview, and execution against real org-unit data.

### What is deliberately not part of this goal yet

- Full org chart delivery.
- Full reporting-line reassignment workflows.
- Broad settings or branding productization unless it directly unlocks the active goal.
- A giant generic import studio.
- Anything outside CoreHR’s foundational scope.

## 7. Default milestone progression from current repo state

1. Keep Tenant Structure Setup & Live Organization Foundation stable.
2. Execute Employee Foundation & Import as the current big goal.
3. Move into Reporting Lines & Hierarchy Integrity.
4. Then build Org Chart & Structure-Aware People Experience.
5. Continue Tenant Configuration & Core Customization productization when it is a real unlock or the clean next milestone.
6. Mature Core Access, Audit & Operational Controls continuously, pulling forward prerequisite controls whenever needed.

## 8. Milestone model and decomposition rules

- A milestone is usually one coherent, reviewable, testable PR-sized slice.
- Usually that maps roughly to one story-sized outcome.
- It can include a few tightly coupled small stories when splitting them further would create waste or broken intermediate states.
- Prefer vertical slices that leave the product in a coherent state.
- Avoid microscopic PRs that move almost no real state.
- Avoid giant PRs that combine unrelated model, API, UI, import, and hierarchy work.

Use these tests when sizing a milestone:

- Can a reviewer understand it in one pass?
- Does the slice make one clear thing become true?
- Can targeted validation prove it works?
- Does it reduce risk or unlock the next step?
- Would splitting it further create fake boundaries or half-delivered behavior?

Recommended partitioning approach:

- Partition by outcome first, not by technical layer first.
- Allow prerequisite groundwork to come first when the active milestone would otherwise be unsafe or misleading.
- Keep tightly coupled model, migration, contract, and minimal consuming flow together when half-delivery would be misleading.
- Prefer productizing existing capability before inventing new capability.
- Lock the product contract before implementing UI: primary audience, non-audience, access path, and gating must be explicit.
- Treat existing backend behavior and current navigation exposure as implementation inputs, not automatic product requirements.
- For MVP frontend slices, prefer feature-local code in the owning app. Only grow shared feature-specific frontend packages when reuse is already real or clearly justified.
- Do not pre-commit to exact PR boundaries for the next feature until that feature is chosen and the current repo state is checked.
- This roadmap should decompose the active big goal into high-level actionable chunks only, not fake exact PR plans.

## 9. PR operating model

1. Choose the next slice from the active big goal or its required prerequisite groundwork.
2. Define what becomes true after that slice, who it is for, how it is reached, and what stays out of scope.
3. Check dependencies and decide whether the work is independent or should be stacked.
4. Open one narrow PR for one concern.
5. Keep validation current while the PR is open.
6. Respond to review without letting the branch accumulate unrelated work.
7. Mark the PR merge-ready only when the slice is coherent, not just partially coded.
8. Update this roadmap and the board alignment note if sequencing, stack context, or scope changed.

## 10. Branching and git hygiene strategy

- Default to one branch equals one milestone equals one PR.
- Branch from `develop` when the milestone is independent.
- Use stacked branches and stacked PRs when there is a real dependency on unmerged parent work.
- Keep stacked children narrow and obviously dependent on the parent.
- Rebase or restack cleanly as parent branches move.
- Cherry-pick only for isolated fixes or explicit unblockers. Do not use it as the default multi-PR strategy.
- Do not let long-lived branches span multiple roadmap areas.
- State parent branch or PR clearly in the PR body when working in a stack.
- If a stack changes the practical execution order, update this roadmap and the board note so the stack stays understandable.
- Follow the branch, commit, and PR naming rules in [../git-conventions.md](../git-conventions.md).

## 11. How to choose the next item

1. Start from the big milestone map, not from isolated board items.
2. Identify the current big goal.
3. Check whether prerequisite groundwork is missing and must be pulled forward first.
4. Prefer productizing capability that already exists before inventing new capability.
5. Pull forward security, access-control, tenant-safety, and data-integrity fixes when they affect the active goal.
6. Use the Scrum board as a guardrail. If a board item fits the roadmap and dependency order, prefer it.
7. If the board points elsewhere but the repo clearly needs a prerequisite first, take the prerequisite and log the deviation here.
8. Avoid hopping between unrelated milestones unless that hop removes a real blocker.

Default next-path from current state:

- prerequisite employee write hardening if still open
- employee roster and employee management productization
- employee-to-org-unit linkage
- employee import foundation
- reporting-line integrity
- directory and org chart

## 12. Reusable next-PR planning contract

Use this exact contract for future planning passes:

```text
Plan the next PR only.

Use this priority:
1. repo reality
2. validated behavior
3. roadmap
4. board
5. older docs

Choose one reviewable PR-sized milestone.
Do not implement code.

Return:
1. recommendation summary
2. why this is next
3. product contract
4. access/navigation contract
5. stack decision (`develop` vs stack on parent PR)
6. PR objective
7. in scope
8. out of scope
9. user story/stories covered
10. implementation plan
11. validation plan
12. risks/open questions
13. suggested branch + PR title
14. follow-up milestone

Rules:
- board is a guardrail, not divine truth
- prefer real prerequisites
- prefer productizing existing capability before inventing new capability
- respect auth, tenant safety, and data integrity
- lock product contract and access/navigation contract before implementation
- do not treat existing backend capability or current nav exposure as product truth without deciding it explicitly
- for MVP frontend slices, prefer owning-app-local changes and avoid new shared feature-specific package surface unless clearly necessary
- avoid tiny wasteful PRs unless truly blocked
- avoid giant muddy PRs
- be decisive: choose one next PR
```

## 13. Update protocol

- Update this file after milestone planning.
- Update it after opening a PR if the sequencing, dependency chain, or stack context changed.
- Update it after review if scope changes materially.
- Update it after completion so the roadmap stays honest about current state.
- Add a short reconciliation note whenever the roadmap intentionally deviates from the board.
- Record major planning decisions that affect later milestones. Keep those notes short and operational.

## 14. Current reconciliation notes

| Area                         | Stale framing                                                                                 | Repo reality                                                                                                      | Roadmap decision                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Roadmap granularity          | The previous draft drifted too low-level around one immediate sequence                        | The roadmap needs to keep the big CoreHR milestone map visible and only decompose the active goal at a high level | Keep the large milestone map as the main planning lens                                |
| Setup status                 | Older setup docs treat setup as the main unfinished track                                     | Setup lifecycle, gating, draft workspace, readiness, governance, publish, and completion are already implemented  | Treat setup as effectively done and do not reopen it as the main roadmap track        |
| Employee productization      | Older roadmap and board history make employee work look more complete than it is in tenant UX | Employee backend exists, but tenant employee pages are still placeholder                                          | Treat Employee Foundation & Import as the current big goal                            |
| Authorization priority       | Historical auth work looks complete from the board view                                       | Employee writes are still only behind generic authentication                                                      | Treat employee write hardening as prerequisite groundwork inside the current big goal |
| Frontend slice planning      | It is easy to jump from broad backend capability or current nav wiring straight into UI work  | Frontend slices need an explicit audience, access, and gating contract first, and MVP feature code should stay local by default | Lock product and access contract before UI work, and prefer owning-app-local frontend changes for MVP slices |
| Tenant customization scope   | Settings can easily drift into vague platform customization                                   | The repo supports bounded Core configuration, not page-builder style customization                                | Keep Tenant Configuration & Core Customization in scope, but bounded and professional |
| Access and audit positioning | Access and audit can disappear into footnotes                                                 | Some controls already exist, some are missing, and some must be pulled forward as prerequisites                   | Treat Core Access, Audit & Operational Controls as a real cross-cutting milestone     |

## 15. Pointers and references

- [HR Fusion Scrum - My items.tsv](HR Fusion Scrum - My items.tsv): board export and backlog guardrail.
- [../core-hr-module-roadmap.md](../core-hr-module-roadmap.md): previous condensed roadmap; superseded by this file.
- [phase-0-audit.md](phase-0-audit.md): historical setup audit; useful for old context, not for current sequencing.
- [tenant_setup_feature_roadmap.md](tenant_setup_feature_roadmap.md): historical setup roadmap; not current execution truth.
- [../current-organization-activation-flow.md](../current-organization-activation-flow.md): current platform-to-tenant activation and handoff reference.
- [../../tenant-provisioning-audit.md](../../tenant-provisioning-audit.md): tenant provisioning lifecycle reference.
- [../git-conventions.md](../git-conventions.md): branch, commit, and PR conventions.
- [../git-conventions/branches.md](../git-conventions/branches.md): branch naming reference.
- [../git-conventions/commits.md](../git-conventions/commits.md): commit message reference.
- [../git-conventions/prs.md](../git-conventions/prs.md): PR title and body reference.

There is no single current CoreHR functionality audit that cleanly reflects the current repo. This roadmap plus the codebase should be treated as the active planning truth.
