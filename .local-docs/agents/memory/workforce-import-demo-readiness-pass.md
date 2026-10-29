---
name: workforce-import-demo-readiness-pass
description: Bounded demo-readiness UI pass on Workforce Import review/ready/People screens; demo file + tenant reset recipe
metadata: 
  node_type: memory
  type: project
  originSessionId: 5936185d-a7e2-4495-8527-151c66153db7
  modified: 2026-08-20T05:48:57.421Z
---

**COMMITTED 2026-08-20** — this pass plus the whole import-experience reengineering (temporal semantics, Employee-Number preservation, topology-aware org semantics) landed in the clean-slate commit set on `refactor/temp-branch` (`10d9b7eb` workforce import, `466d1187` org semantics, `e8108bc6` People/temporal, `07aa2c07` chore); not pushed.

Surgical demo-readiness pass on the Workforce Import journey (from a ChatGPT review the user endorsed), on top of the implemented `workforce-import-establishment`. All 7 fixes rendered-verified in the running app (tenant10, login `admin@tenant10.com` / the local password (`FUSION_LOCAL_PASSWORD`)).

Changes:
1. **Grouped issue count** — backend `WorkforceReviewCountsDto.OpenIssueCount` (distinct decision keys + row-specific blockers, computed bounded over NeedsAttention rows in `WorkforceImportReviewService.ComputeOpenIssueCountAsync`). Command region now reads "N issues to resolve · M employees affected", button "Next issue".
2. **Manager as person** — `ResolveManagerDisplay` in review service turns same-import → target row name + subtext "Also being added"; existing → snapshot name. Added `Subtext` to `WorkforceReviewManagerDto` + FE `manager.subtext`.
3. **Org candidate ranking** — `review-inspector.tsx` `fold()`/`relevance()`/`matchScore()` accent-insensitive ranking so plausible units surface first.
4. **Ready transition** — review workspace effect: when needsAttention→0 while filter=NeedsAttention, auto-switch to New so the 14 stay visible (no empty payoff).
5. **Ready copy** — "N employees will be added · existing employees stay unchanged".
6. **People sort** — `PeopleQueryHandler.BuildOrderBy` default now `lower(DisplayName)` (roster shows "First Last", so "Name A–Z" matches the visible name).
7. **Processing continuity** — `PreparingNotice` carries filename + "Read source · Preparing workforce".

Verify: CoreHR built to normal bin, relaunched (env `ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5301`, `--no-launch-profile`; the `http` launch profile does NOT set Development so Jwt:Secret from appsettings.Development.json isn't read). FE type-checks clean.

Demo asset + reset:
- Realistic file: `C:\Users\wsmtr\AppData\Local\Temp\claude\asteria-workforce-demo.csv` — 14 rows, French headers (Matricule/Prénom/Nom/Date embauche/Département/Poste occupé/N+1), ISO dates (lands straight in Review), 2 grouped org ambiguities ("Success"×6, "Growth"×3 → 9 affected / 2 issues), 5 exact-match clean New, 3 generated numbers (blank Matricule), same-import N+1 manager chains. Org values chosen to be intelligibly ambiguous against the tenant's real Asteria org (Customer/Enterprise/SMB **Success**, **Customer Growth**).
- Tenant10 = TenantId `2c24ca26-05df-4ae1-ab26-2a84fa49e0ea`; kept its 8-unit Asteria org, wiped workforce for a clean replay.
- Reset recipe (psql `/c/Program Files/PostgreSQL/18/bin`, postgres / `FUSION_PG_PASSWORD`, db hris_corehr): DELETE tenant rows in FK order ManagerRelationships→WorkAssignments→WorkEmailOccupancies→Employments→WorkforceAuditEntries→WorkforceImportHistories→WorkforceImportApplyOperations→WorkforceImportRows→WorkforceImportSources→WorkforceImportSessions→Employees→EmployeeNumberAllocators (last one resets generated-number counter to EMP-00000001).

Replay: shell `http://localhost:3000` → `/core/people` (empty establish state) → Import workforce → upload the CSV → resolve Success + Growth → Complete import → People roster A–Z. See [[workforce-import-establishment-proposed]], [[next-dev-build-output-split]], [[local-dev-auth]].

## Convergence pass 2 (UX architecture) — uncommitted, rendered-verified

Second bounded pass (another endorsed ChatGPT review). All 9 items verified live + core prod build clean + focused tests green. Employee Profile deliberately NOT touched (revisited with temporal workforce maintenance). No new feature started.

- **Route/session model**: `/core/people/import` = entry (`workforce-import-entry.tsx`); `/core/people/import/[sessionId]` = active workspace (`workforce-import-session.tsx`). Old monolithic `workforce-import-workspace.tsx` deleted. Deep-link/refresh/resume safe (session derives from id).
- **`import-shell.tsx`** (`ImportShell` + progress spine Source→Read→Understand→Review) is the one frame all states render inside — kills the "stitched together" feel. Review workspace lost its own header (shell owns title/baseline/source).
- **Resume** reworked to a "Current import" card matching intake grammar; "Continue import" → session route.
- **Filter labels**: "Needs attention · 9 people" (unit explicit vs grouped issues).
- **Org resolution**: explicit "Suggested matches" (ranked, review evidence only, never auto-choose) over "All organizations" + search.
- **Shared `organization-tree.tsx`** (`OrganizationTree`, Core-owned, real carets/expand-collapse, branch/leaf marker, parent-path, search, a11y) now used by People org filter + Hire + Add-Existing (`establishment-workspace` OrganizationPicker) — replaced two flat-indent duplicates. Import resolver keeps its ranked list but shares the icon/name/path grammar.
- **People Work cell** (`OrgPath showAncestry`): title + org name only; full path is a hover `title` (not a printed ancestry line).
- **Pagination** unchanged (already correct): server-side, gated on `totalPages>1` (PAGE_SIZE 25) — verified hidden at 14, visible+Next at 30.
- **Semantic assist** verified: interpret state + Suggest meanings + graceful unavailable (Groq NOT configured in this local run) + manual mapping + provider hidden.
- QA files in `%LOCALAPPDATA%\Temp\claude`: `asteria-workforce-demo.csv` (the replay file), `semantic-test.csv` (unknown "Centre de coût" column), `pagination-test.csv` (30 rows).

## Final tweaks + ARCHIVED (2026-08-18)

- **OpenSpec `workforce-import-establishment` ARCHIVED** as `2026-08-18-workforce-import-establishment` (specs synced: +58/~5/-2). Change complete 45/45. Still **not committed/pushed** (openspec/ is gitignored anyway).
- Source-intake polish (user-requested): dropzone made **full width**; light-mode fills switched from `bg-muted*` (0.967, invisible on 0.975 bg) to **`bg-foreground/[0.035–0.06]`** for the dropzone + "Workforce as of" icon (theme-aware, visible in light, subtle in dark); dropzone inner icon circle → `bg-card`.
- Active-session landing reworked to the `/organization/import` pattern: on `/core/people/import` the "Current import" card now shows at the **top** (full-width, compact horizontal bar: filename · Workforce as of · N new · N existing · attention badge; Continue import / Discard) **with the dropzone still below** ("Start a new import"), instead of replacing it. Uploading while a session is active surfaces "You already have an import in progress…" (backend enforces one active session/tenant).
