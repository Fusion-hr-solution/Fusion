# B-089 · Cross-slice polish: audit findings (phase 1)

Audit of what Performance slices 1–6 built, against `DESIGN.md`, B-068 decisions, B-069 surface architecture and the slice reviews. Nothing changed in product code. You pick what gets fixed; fixes come in batches (proposed at the end).

**Evidence base (2026-10-23)**
- **Walked live** through the shell (dark, 1440×900): the Planning preset as Aicha, Mariam, Omar and Amira (`B-089-screens/planning/`); the Mid-year preset as Aicha (`B-089-screens/midyear/`). Script: `data/screens-cross-slice-polish.cjs`. Each preset folder has a `walk.json` with each page's URL, failed calls and console errors.
- **Not walked this session:** Mid-year as Mariam, Omar and Amira, plus Year-end, Next cycle and Fresh. Claude Code stopped the walk when the machine ran low on memory. For those phases, findings use the B-095 preset screens from 2026-10-22 (`B-070-slice-6-screens/live/s7-*`, `s6-*`). Those are the same presets in the same states, captured one day earlier. Every finding resting on them is marked ⧗.
- **Code checks** back every systemic finding (file:line given).
- Raw per-screen notes: `B-089-screens/notes.md`.
- Presets were built 2026-10-22, so every "today" in them is one day stale. A 1:1 seeded for "today" is now one day overdue, which is how finding 1 surfaced.

Severity: **High** means wrong information, a broken flow or a broken approved rule. **Medium** means friction, inconsistency or a visible DESIGN.md breach. **Low** means polish.

---

## High

### 1. A missed 1:1 makes the whole series disappear from Home, Overview and the person page
- **Where:** Home "Next two weeks", Overview "Conversations" and R9 "Next 1:1", for every persona (planning, midyear).
- **What's wrong:** The 22 Oct meeting wasn't marked held. The 1:1s page shows it as "Next up · overdue". Everywhere else it's gone: Home says "Nothing is scheduled in the next two weeks" for Mariam, even with a weekly series with Amira and a fortnightly one with Aicha. Mariam's Overview has no Conversations row. R9 says "Next 1:1 Thu 22 Oct" for a past meeting.
  - Cause: `UpcomingFeature.OneOnOnesAsync` keeps only `ScheduledAt >= now`. The projected slots (29 Oct, 5 Nov on the series timeline) aren't meetings. The next meeting only exists once the overdue one is completed, so one missed meeting stalls the series.
- **Fix:**
  - Treat an unheld past meeting as owed work ("1:1 with Mariam didn't happen · Complete or reschedule"). It leads Conversations and appears on Home.
  - Have upcoming moments include the series' projected next slot.
  - R9 says "Overdue since Thu 22 Oct" rather than "Next".
- **Screens:** `planning/mariam-01-home.png`, `planning/mariam-02-overview.png`, `planning/mariam-05-one-on-ones.png`, `planning/amira-16-series.png`, `planning/mariam-16-person.png`.

### 2. Counts that contradict what's on screen
- **What's wrong (each instance):**
  - **"0 objectives" for plans that have 3.** Reviews "Your year so far" shows "– Plan progress · 0 objectives" for Aicha (submitted, 3 objectives) and Omar (draft, 3). The 1:1 side panel shows "Mariam's year · 0 objectives". These summaries count only approved objectives.
  - **Mariam's 1:1s:** the header says "2 open actions" while the side panel says "Actions you owe · Nothing open". The header counts actions other people owe.
  - **Reviews (FY2026):** "Asked of you **0**" sits above one listed request (Leila · Sent).
  - **Plan progress rounds three ways:** 37.9% (series), 38% (Home and My Plan) and 42.1% (the objective's value) sit side by side.
- **Fix:**
  - Count the plan's objectives in any state, and say "not started" when progress is null.
  - The 1:1s header counts only what the viewer owes.
  - "Asked of you" counts what it lists, or lists only open requests.
  - One rounding rule for plan progress.
- **Screens:** `planning/aicha-09-reviews.png`, `planning/omar-08-reviews.png`, `planning/amira-16-series.png`, `planning/mariam-05-one-on-ones.png`, `planning/aicha-14-reviews-last-year.png`, `midyear/aicha-08-series.png`.

### 3. Reviews leaves the sidebar whenever the selected cycle has no review
- **Where:** the sidebar for Aicha, Mariam and Omar during Planning.
- **What's wrong:** Their FY2026 results exist, but Reviews only appears after switching the cycle to FY2026. B-069 S-02 shows Reviews to "anyone with review work in any cycle". The sidebar changes shape as the cycle switcher moves.
  - Cause: `WorkspaceContextFeature.cs:82` computes the destination for the selected cycle only.
- **Fix:** Compute the destination across cycles: any readable review, peer request or round. On a cycle without a review, the Reviews page leads with past results.
- **Screens:** `planning/aicha-02-overview.png` (no Reviews), `planning/aicha-13-overview-last-year.png` (Reviews appears).

### 4. A company value's colour changes with the viewer and with load timing
- **Where:** praise on Home, Feedback › Praise, feedback chips.
- **What's wrong:** "Secure Engineering" is violet for Aicha and blue for Mariam; "Customer Partnership" is blue for one and teal for the other. DESIGN §2: "A category keeps its hue everywhere (assigned from its id)".
  - Cause: `performance-ui/src/values.tsx valueTone` uses the catalogue index once the catalogue has loaded and an id hash before that. The hue flips mid-render, and the shell's home often uses the hash.
- **Fix:** Derive the hue from the id alone, or have the server serve it with the value. Never from list position.
- **Screens:** `planning/aicha-01-home.png` vs `planning/mariam-01-home.png`.

### 5. The objective full page is card soup and doesn't match the drawer or the plan
- **Where:** `/performance/cycles/{c}/objectives/{o}` on direct load, and reached from Overview's direction rows. Seen as Aicha and Mariam.
- **What's wrong:** It's the most "generic admin" screen in the module:
  - a Measurement card holding three more cards (Type, Measure, Target);
  - Timeline and Plan weight tiles, each with icon well + title + muted sentence ("Tracked against a numeric target.", "Share of overall plan", "12 months");
  - a large donut for one number (40%);
  - a column that stops at two-thirds width with nothing beside it;
  - a plain "Overview" crumb even when you didn't come from Overview;
  - the plan's state ("Submitted", "Draft plan") as the objective's badge.

  This breaks DESIGN §9 (cards in cards, icon + heading + sentence blocks, ledger page) and S-03 R3 (measure and progress, status history, evidence, alignment, requests, feedback).
- **Fix:** Rebuild the full page as the drawer's anatomy in document + sidebar:
  - main column: progress and status history, then evidence, update requests and feedback;
  - sidebar: measure, target, weight, dates, alignment and owner as hairline-separated properties.
  - Breadcrumb from the referrer or the plan.
- **Screens:** `planning/aicha-17-objective-page.png`, `planning/mariam-12-objective-drawer.png` (a hard navigation, the same page), `midyear/aicha-07-objective-page.png`.

### 6. Dates come in at least six formats, sometimes in one row
- **What's wrong:**
  - Formats in use: "Oct 10, 2026" (top bar), "10 Oct – 9 Nov" and "9 Sept" (year band), "Tue 20 Oct" (Overview), "Mon, Sep 21" (review), "Jun 16, 2026" (feedback), "22 OCT 11:00" (1:1s), "Saved Oct 17, 2026, 3:00 PM".
  - On one series page: "Weekly since 27 Oct" (no year, reads as a future date) and "since Oct 27, 2025".
  - In one action row: "From 15 Oct" next to "Overdue Oct 20, 2026".
  - Cause: Performance has 7 exported date formatters, two of them named `formatDate` (`features/performance/lib.ts:43`, `performance-ui/src/summary-lib.ts:45`), plus ad hoc `toLocale*` calls in about 20 files, including the shell's `home.tsx`.
- **Fix:** One date grammar in `@repo/ds` used by every app:
  - "Tue 20 Oct" within the current year, "20 Oct 2025" otherwise;
  - ranges "10 Oct – 9 Nov 2026";
  - relative times only for recency ("3 days ago").
  
  Lint-guard raw `toLocale*` in owned apps.
- **Screens:** `planning/aicha-02-overview.png`, `planning/aicha-18-review.png`, `planning/amira-16-series.png`, `planning/mariam-03-my-plan.png`.

### 7. Typography doesn't follow DESIGN's roles: ALL-CAPS overlines everywhere, numbered wells, a serif badge inside the title
- **ALL-CAPS overlines:** 97 `type-eyebrow` uses. Every objective card (MEASUREMENT, TARGET, DURATION, WEIGHT, CURRENT VALUE) and every sidebar group (STATUS, PLAN PROGRESS, REVIEWER, DIRECTION) gets one. DESIGN: "sparingly"; §9 lists "ALL-CAPS eyebrows above every heading".
- **Numbered wells:** 01/02/03 on objectives in My Plan, the plan record, the review and Core's Performance view (`plan-objective-row.tsx:129`, `review-record-page.tsx:409/456/548`, `performance-ui/summary-objectives.tsx:46`). §9 bans numbered markers on content that isn't a sequence. Their colour also changes by surface: amber/blue by alignment on the plan, all amber on the review.
- **Badge inside the title:** the plan state badge is inside the `h1` (`my-plan-workspace.tsx:28`, plan record). It renders in Lora, and the heading's accessible name is "My PlanDraft" / "Aicha BouaziziSubmitted".
- **Raw sizes:** about 650 raw size/weight utilities in 64 Performance files (197 `text-sm`, 151 `font-medium`, 129 `font-semibold`, 120 `text-xs`, arbitrary 8–13px sizes). §3 says roles only. The `design-roles` lint checks role names, not raw sizes.
- **Fix:**
  - Badge out of the `h1`.
  - Drop the numbered wells; the alignment mark already tells objectives apart.
  - Keep eyebrows only where a group has no heading.
  - Extend `design-roles` to warn on raw text-size and weight in owned apps, then migrate file by file.
- **Screens:** `planning/aicha-03-my-plan.png`, `planning/mariam-11-plan.png`, `planning/aicha-18-review.png`, `planning/aicha-12-core-profile-performance.png`.

---

## Medium

### 8. Amber does too many jobs
- **What's wrong:**
  - Full amber-tinted, amber-bordered blocks for routine things: the Home lead card, the released review's result card, the FY2026 Reviews hero.
  - "10 days late" in brand amber; lateness is a warning or danger state, not the accent.
  - Amber text links for every secondary navigation on R9 ("Open plan", "Open 1:1s", "Open development").
  - Amber "COMPANY" category labels on the map.
  - My Plan's donut colours objectives amber/blue while the legend beneath uses amber for "at risk", so one colour means two things in one panel.

  DESIGN §2: amber is punctuation; the screen must still read without it.
- **Fix:**
  - Leads and heroes on `bg-card` with one amber action.
  - Lateness in warning or destructive.
  - Secondary links in foreground with a chevron.
  - Category labels muted.
  - Plan donut segments by status colour, or one neutral fill.
- **Screens:** `planning/aicha-01-home.png`, `planning/aicha-18-review.png`, `planning/aicha-14-reviews-last-year.png`, `planning/mariam-16-person.png`, `midyear/aicha-03-my-plan.png`, `midyear/aicha-05-goals.png`.

### 9. The employee's 1:1s page repeats one fact four times (absorbs B-088)
- **Where:** `/performance/one-on-ones` as Aicha and Mariam.
- **What's wrong:**
  - For Aicha's single series, "1 open action" appears in the header, "1 action overdue" in the hero, "1 overdue" in the row and "Actions you owe · 1" in the side panel.
  - The one series shows twice: the hero card plus a one-row "With your manager" table.
  - Mariam's hero is her own manager's meeting, repeated again as "With your manager" in the side panel, while five reports show five equal "+ Start 1:1s" buttons.
  - The cycle switcher stays in the top bar on these cycle-free pages (S-07).
- **Fix:**
  - An employee with one series lands on a single next-meeting block plus actions, with no table.
  - A manager gets the team table with a single "Start 1:1s…" (pick people) on its heading.
  - The side panel drops whatever the main column already shows.
  - Hide or quiet the cycle switcher on `/one-on-ones` and `/feedback`.
- **Screens:** `planning/aicha-04-one-on-ones.png`, `planning/mariam-05-one-on-ones.png`.

### 10. Feedback: empty states, summaries and the team view (absorbs B-088)
- **What's wrong:**
  - **Requests tab:** two empty-state styles side by side (a green-check "Nothing to answer" and a dashed box with a second "Ask for feedback" button that duplicates the header's). The box stops at about 1180px while the header spans the full width.
  - **Summary bars carry no information at low counts:** the Received bar is full width for one value, and every "What we celebrate" bar is full at count 1. "Given by you 0 · 0" tiles add nothing.
  - **Manager team feedback** sits behind a second segmented control (You | Your team) under the Received tab, and was still loading at capture.
- **Fix:**
  - One empty-state pattern (a quiet line), with no repeated header action.
  - Bars only when there are at least two values and a total worth comparing; otherwise a plain list with counts.
  - Drop zero tiles.
  - Lift "Your team" to its own tab for managers.
- **Screens:** `planning/aicha-05-feedback-received.png`, `planning/aicha-07-feedback-requests.png`, `planning/aicha-08-feedback-praise.png`, `planning/mariam-08-feedback-team.png`.

### 11. The Reviews workspace without a review in the cycle is a bento of tiles
- **Where:** Reviews in Planning (every persona) and FY2026 closed (Aicha).
- **What's wrong:**
  - Four equal KPI tiles with icon wells ("Your year so far"), one of them wrong (finding 2).
  - On a closed cycle: an amber hero with an all-green stepper that still leads after release, plus "Past results" repeating the same review just shown in the hero.
- **Fix:**
  - No review this cycle: lead with past results and when the next round is expected; no tiles.
  - Released: the result leads, the stepper recedes to one line, and Past results excludes the one shown.
- **Screens:** `planning/aicha-09-reviews.png`, `planning/aicha-14-reviews-last-year.png`.

### 12. Organization direction shows dashes and empty tracks all year
- **Where:** Overview's direction rows (all personas, Planning and Mid-year) and the company nodes on the map.
- **What's wrong:** Mid-year, the child objectives are at 40–45% with statuses, but company objectives still read "Not reported · No progress yet" with "—" and empty tracks. In Planning, row 1 has no track and rows 2–3 have empty ones. The section reads as broken.
  - It's also the only framed card list in an otherwise unframed Overview.
- **Fix:** Company rows show what is true: aligned count and child-status mix (dots), with no progress track until a measure exists. During Planning, show "3 company objectives · 18 objectives aligned" instead of tracks. Unframe the list to match the other rows.
- **Screens:** `planning/aicha-02-overview.png`, `midyear/aicha-02-overview.png`, `midyear/aicha-05-goals.png`.

### 13. "Open" as the action label on Home and Overview
- **Where:** the Home lead and agenda (`packages/ds/src/shell/home.tsx:150,180`) and the Overview owed-action row (`overview-rows.tsx:597`).
- **What's wrong:** "Open" doesn't say what happens. DESIGN §8: actions name the outcome. Elsewhere the product already says "Record progress", "Review Aicha's plan".
- **Fix:** Derive the verb from the work-item kind ("Continue your plan", "Review plan", "Answer", "Record progress", "Complete action"). Add an optional `actionLabel` to the work-item contract if the kind isn't enough.
- **Screens:** `planning/aicha-01-home.png`, `planning/mariam-01-home.png`, `planning/aicha-02-overview.png`.

### 14. Narration and placeholder blocks the structure already carries
- **What's wrong (each instance):**
  - My Plan subtitle "Planning & Agreement" / "Execution & progress".
  - "Approved & locked · Approved by Mariam Gharbi. This is now your locked baseline."
  - "Plan progress — Starts once the plan is approved" in every pre-approval sidebar.
  - The reviewer lens shows "Reviewer: Mariam Gharbi" to Mariam herself.
  - "Amira Khelifi approves it once you submit."
  - "Open goals can carry into the next cycle when it starts." (said after it has started; `overview-rows.tsx:59`).
  - "4 checks passed · Your plan meets all requirements." with the four green checks expanded by default.
  - The plan page's "No plan for your account · A performance plan is available to employees included in an active cycle." (B-069: "You're not part of this cycle", with the switcher). The same notice shows when the workspace call fails, which is misleading.
  - Header "1 this week · 1 open action" on 1:1s.
- **Fix:** Delete or fold into existing state:
  - Hide Plan progress until approval.
  - Show the plan owner, not the viewer, in the reviewer lens.
  - Collapse the checks when all pass.
  - Use B-069's not-a-participant line.
  - Give a failed workspace call the error state.
- **Screens:** `planning/aicha-03-my-plan.png`, `planning/mariam-03-my-plan.png`, `planning/mariam-11-plan.png`, `midyear/aicha-03-my-plan.png`, `planning/aicha-13-overview-last-year.png`.

### 15. The Development section offers carry-over above an empty state that contradicts it
- **Where:** My Plan in Planning (Aicha).
- **What's wrong:** An amber-tinted "2 open goals from FY2026 · Dismiss · Bring over" banner sits above a dashed "No development goals yet + Add a goal". Two amber primaries are stacked, and the empty state denies the offer above it.
- **Fix:** When carry-over is offered, list the two goals with "Bring over" as the section's action, and show the empty state only when there is nothing to offer.
- **Screens:** `planning/aicha-03-my-plan-p2.png`.

### 16. Pages sit at different widths, so the title jumps between sidebar items
- **What's wrong:**
  - `PageContainer` is used as default (18), `wide` (14) and `className="max-w-7xl"` (3).
  - Inner `max-w-5xl` (Overview) and `max-w-4xl` (review record, feedback) constrain further.
  - The page title sits at x≈300 (Overview), 288 (My Plan, Reviews) and 404 (review record).
  - The back affordance varies: "← Overview" (map), "← Reviews" (review), a plain "Overview" crumb plus "FY2027" on the right (objective).
  - `PerformancePageHeading` (17 users) is a local copy alongside `@repo/ds/shell` `PageHeader` (1 user).
- **Fix:**
  - Two widths only: document (record, Overview) and collection (tables, map).
  - One heading component in `@repo/ds/shell`, with one back/breadcrumb rule.
- **Screens:** compare `planning/aicha-02-overview.png`, `planning/aicha-03-my-plan.png`, `planning/aicha-18-review.png`, `planning/aicha-17-objective-page.png`.

### 17. The home lead puts your own work ahead of someone waiting on you
- **Where:** Home, Mariam in Planning.
- **What's wrong:** "Write your plan · 17 days left" leads. "Review Aicha's plan" (submitted 3 days ago and blocking her) sits under "Also needs you". Call 8 (earliest due leads) didn't weigh blocking.
- **Fix:** A decision another person is waiting on outranks your own non-overdue work. Within each class, earliest due wins.
- **Screens:** `planning/mariam-01-home.png`.

### 18. Next cycle on the HR Overview: a ready Draft still says "Continue setup", and a passed start date says nothing
- **Where:** ⧗ Next cycle preset, Amira.
- **What's wrong:** Launch readiness reads "2 of 2 ready" as a nested framed checklist inside the row, yet the action is "Continue setup". The planned start (23 Oct) has passed without activation, and nothing flags it.
- **Fix:** When ready, the row's action is "Activate FY2027" and the checklist collapses to one line. After the planned start, the row says "Planned start passed · Activate or change the date".
- **Screens:** `B-070-slice-6-screens/live/s7-21-overview-hr-closed.png`.

### 19. My Team's summary strip and status cells change anatomy between phases
- **Where:** ⧗ My Team in Planning, Execution and Review.
- **What's wrong:**
  - The summary strip is a segmented bar plus legend in Planning and Execution, but three KPI columns with dividers in Review.
  - Plan state is a badge with an icon in Planning; in Review, state is green text with a dot.
  - In Execution the "Needs attention" quotes wrap to 4–5 lines and "15 days ago" wraps.
  - In Planning, Omar's "3 · weights 100%" wraps in every row.
- **Fix:** One strip pattern (segmented bar + legend) for every phase, `StatusBadge` for stage cells, quotes clamped to two lines (full text on the row's record), and fixed widths for the short numeric columns.
- **Screens:** `planning/mariam-04-my-team.png`, `planning/omar-04-my-team.png`, `B-070-slice-6-screens/live/s7-23-team-execution.png`, `s6-24-team-review.png`.

### 20. B-085: side-stripe accents remain, including two not on the list
- **What's wrong:**
  - Still in Core HR as listed: `my-profile.tsx:279`, `organization-chart.tsx:70`, `people-profile-workspace.tsx:552`, `people-workspace.tsx:468`, `workforce-ui.tsx:224`, `activation-plan.tsx` 240/446/819/1054, `workforce-access-workspace.tsx:277`.
  - Not on the list: Core `tenant-setup/setup-launchpad.tsx:594` (a `w-1` brand seam) and **Performance** `goals/objective-workspace.tsx:566` (the "Aligned to" card, `w-1 bg-primary/25`). The board's "Performance has none left" is wrong.
- **Fix:** Replace each with a status badge, a leading mark or structure (§9).
- **Screens:** code only.

### 21. B-097: Slice 6 loose ends, still open in code
- **What's wrong:**
  - The year band says "Plans due Mon 9 Nov" to people whose plan is already submitted or approved (`overview-model.ts:50`; seen for Aicha).
  - ⧗ Insights by unit lists units with nobody in the round as "0 of 0" rows.
  - My Team's `?view=needs-review` still applies a hidden filter during a round (`team/page.tsx:38`).
- **Fix:**
  - The band's next-date label follows the viewer's own state ("Plan approved" or the next date that concerns them).
  - Drop zero-population units.
  - Ignore the param when the filter control is hidden.
- **Screens:** `planning/aicha-02-overview.png`; ⧗ `s6-26-insights-review.png`.

### 22. B-100: Overview with no cycle
- **Where:** ⧗ Fresh preset, Amira.
- **What's wrong:** Only "No performance cycle yet" plus Create a cycle. Board 16 calls for organization readiness from Core HR, rating scale and competencies, company objectives, and starting 1:1s.
- **Fix:** As board 16. It's the first screen of the demo's prologue.
- **Screens:** `B-070-slice-6-screens/live/s7-16-overview-hr-no-cycle.png`.

---

## Low

### 23. Smaller issues
- **Praise reactions** are four unlabelled icons with no visible counts. Add accessible names and visible counts, or one "React" menu.
- **Overlapping avatar pairs crop the first initials** ("MG" under "OM") on praise and 1:1 headers.
- **A person-avatar slot shows a module initial** ("P") on Home's "Also needs you" row.
- **Recent lists your own review in the third person** ("Aicha Bouazizi's review"). Use "Your year-end review".
- **R9 says "Finalized 21 Sept 2026"** where everything else says "Released". One word per concept.
- **The Overview direction meta reads "Company · 2 aligned · Amira Khelifi"**, an "A · B · C" string (§9). Split owner from counts.
- **The objective drawer's backdrop blurs the list behind it** almost to illegibility (S-04 keeps the list behind). Dim without blur.
- **"Close cycle" is the only header action** on the Cycle record 13 days into the year. Move it to the record's closure section until Review ends.
- **Core profile › Performance calls `GET /api/corehr/settings` and gets 403** (plus a console error) for a non-admin viewing their own profile (`walk.json`, Mariam). Don't fetch admin settings for non-admins.
- **The 1:1 series' private note box says "Only you" and "Only you see this".** Keep one.
- **The series' Rhythm select renders its value centred.**
- **The map's dotted-grid canvas background** is decoration (§9 "dot grids").
- **Core HR profile header's decorative amber arc** (top-right).
- **Slice parity gaps, still open:**
  - Slice 4 board 09's "meanwhile" links (development, next 1:1) after submitting a self-assessment.
  - Slice 5's nine-box per-cell +1/−1 counts.
- **B-080: not reproducible at 1440.** The milestone metadata row ("1 of 3 done") fits without collision (`midyear/aicha-03-my-plan.png`). I propose closing it.
- **Settings (B-071, out of scope):** an em dash in copy, and helper text under every field. Noted for B-071.

### 24. Frontend architecture
- **Legacy redirects with no producers left:** `/team/[planId]` (client-side, waits on the current cycle) and `/reviews/rounds/{id}/setup/[[...step]]`. Delete both; nothing links them (grep), and nothing outside the product depends on them before release.
- **Oversized modules:**
  - `goals/objective-workspace.tsx` 1503 lines, `team/team-direction.tsx` 1275, `goals/org-objective-composer.tsx` 1226, `reviews/review-record-page.tsx` 971, `plan/goal-composer.tsx` 901, `one-on-ones/series-record.tsx` 848.
  - One 681-line hooks file for the whole module (`api/use-performance.ts`).
  - 390 lines of logic in a route file (`app/(pages)/goals/page.tsx`).
  
  Split along the sections each page already has; one hooks file per workspace.
- **Request waterfalls:** `team-direction.tsx` waits on Core HR's `useWorkforceMe` before its own query. My Team's lower section, the Cycle record, Insights and the map were still skeletons after 25 s under the dev proxy. Remove the dependency where the server can resolve "me".
- **Dev only (not product):** the shell's `/api` route handler took 4–24 s per call during the walk while the gateway answered in milliseconds. Worth its own item: it makes local QA very slow.

---

## Proposed batches (pick any)

| Batch | Findings | Kind | Verified by |
| --- | --- | --- | --- |
| A · Truthful states | 1, 2, 3, 21, 17 | backend + frontend logic | Performance tests, API journeys, app tests |
| B · Value hue + dates | 4, 6 | shared `@repo/ds` / `performance-ui` | ds + performance + shell tests, type-check |
| C · Objective record page | 5 | Performance UI | type-check, lint, tests, before/after screens |
| D · Typography and amber | 7, 8, 23 (visual items) | DS lint rule + Performance UI sweep | lint, type-check, screens |
| E · Conversations polish (B-088) | 9, 10, 13 | Performance + shell UI | tests, screens |
| F · Reviews, Overview and plan cleanup | 11, 12, 14, 15, 18, 19 | Performance UI | tests, screens |
| G · Frame consistency | 16 | `@repo/ds/shell` + Performance | type-check, cold build, screens |
| H · No-cycle Overview (B-100) | 22 | Performance UI + reads | tests, screens |
| I · Side stripes (B-085) | 20 | Core HR + Performance UI | core + performance lint/tests |
| J · Architecture | 24 | refactor, no visible change | type-check, lint, tests, cold build |

Each batch's before/after screens go in `B-089-screens/after/`. The phases not walked live (⧗) get walked once memory allows, before their batches close.

---

## Phase 2: what was fixed (2026-10-23)

The user delegated the pick ("do whats best"). Uncommitted, nothing staged.

| # | Outcome |
| --- | --- |
| 1 | Fixed. An unheld 1:1 stays the series' next meeting (Overview, R9 say "overdue"); once its day passes it's owed work for both people (`one-on-one-meeting`, "Complete or reschedule"); upcoming counts from the start of today. |
| 2 | Fixed. Reviews counts the plan's objectives in any state (weighted progress once approved); the 1:1 side panel says the plan's state instead of "0 objectives"; the 1:1s header counts what you owe; "Asked of you" hides a 0; progress rounds to whole numbers (weights keep one decimal). |
| 3 | Fixed. Reviews is a destination for review work in any cycle. |
| 4 | Fixed. A value is neutral until the catalogue loads, then keeps its hue. |
| 5 | Fixed. One hairline facts section (measure, target, window, weight, milestones); page is document + sidebar; back link to "My Plan", "{owner}'s plan" or Organization direction; the plan's state left the objective's badge. |
| 6 | Fixed. `@repo/ds/lib/dates` is the one grammar (year only outside this year); Performance, performance-ui and the home delegate to it; Core, Platform and DS date controls pinned to en-GB; `design-roles` warns on browser-locale dates. |
| 7 | Partly. Numbered wells gone; overlines are sentence case except date chips; badge out of the `h1`. Raw size/weight utilities → **B-101**. |
| 8 | Partly. Review result card, map category labels, R9 links and the plan ring are no longer amber; "at risk" uses warning. Home lead kept as approved on the slice 6 canvas. |
| 9, 10, 13 | Fixed (B-088). 1:1s says each fact once; switcher hidden on 1:1s and Feedback; Feedback team tab; honest bars; quiet empty states; `actionLabel` on work items. |
| 11, 12, 14, 15, 18, 19 | Fixed. Plan rail's "Plan progress" placeholder kept: D-08 keeps the rail's structure in every state. |
| 16 | Partly. One frame width; one heading component → **B-102**. |
| 17 | Not changed: it alters approved call 8 → **B-103** (Needs discussion). |
| 20 | Fixed (B-085): no side stripes left in Core, Performance, shell or shared packages. |
| 21 | Fixed (B-097). |
| 22 | Fixed (B-100): no-cycle readiness for administrators and "Start your 1:1s". |
| 23 | Partly: B-080 rechecked (fits at 1440); perpetual ping removed; the rest stays open. |
| 24 | Partly: the two legacy route redirects deleted (`LegacyRecordRedirect` kept, the record hook still reads `?objective=`). Big-file splits and the team-direction waterfall not done. |
