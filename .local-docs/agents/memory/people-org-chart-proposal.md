---
name: people-org-chart-proposal
description: "B-094 people org chart: accepted with card design C; sessions A, B, C (open roles B-128) built and committed by 2026-10-28; In review"
metadata:
  node_type: memory
  type: project
  originSessionId: 0dc9232d-2af0-412c-b144-4b2c7821c1a4
  modified: 2026-10-27T12:06:21.793Z
---

B-094 people org chart was researched, proposed and accepted on 2026-10-27; it was built in three sessions, all done by 2026-10-28.
- **Explorer:** https://claude.ai/artifact/2iA3tx4XuHyv1KoMtTyNfd. It has a working prototype on Carthage's 100 people, viewed as Aicha, Mariam or Nour. The user's verdicts save to the artifact's db (`verdicts/C-1…C-12`, `meta/general`); read them with ArtifactData before building.
- **Brief:** `.local-docs/agents/plans/B-094-people-org-chart.md`. Its source HTML is `plans/B-094-org-chart-explorer.html`.

**Key calls:**
- A Core HR nav item "Org chart" for everyone, at `/core/org-chart`.
- Opens around you.
- Whole company by default; tenants narrow it in Roles (`core.orgchart.view` joins the Employee role).
- A directory card.
- One lens at a time.
- Time travel for HR only.
- Drag hands off to the Change manager task.
- A new `GET /api/corehr/org-chart?asOf&root&depth`, which replaces the unused, unscoped `employees/org-chart`.
- Engine chosen by fit: built on the canvas's own transform stage, not React Flow (session A).

**Why:** the user wanted design-first wow and asked the agent to make the decisions (see [[decide-surface-architecture-yourself]]).

**Verdicts (read 2026-10-27):** 9 of 12 on board. C-5: the cards were too bland, small and thin on facts, so B-126 redesigns them as a card canvas first. C-10: the user wants the engine chosen by fit, not by reuse. C-12 needed plain explaining. B-127 (profile redesign like BambooHR) is in Needs discussion.

**Card design C accepted (B-126, 2026-10-27).**
- One card per person.
- Portrait leader cards: the avatar breaks the top edge, plus a faces strip and a fold toggle.
- Rich person cards on a two-column spine under the manager.
- The CEO card leads.
- Division colour is on by default.
- Start year shows for everyone.
- Live reference: https://claude.ai/artifact/RhvSgNrBzG8DbB48mJoUDF.

The user rejected folding a team into its leader's card (it cuts the nodes the chart lives on) and plain uniform cards ("too minimal, no appeal"). Show designs in the real chart, never as isolated components (user: "i need to see the designs in real example rather than on their own").

**Built:** session A (committed 2026-10-27: chart for everyone, `GET /api/corehr/org-chart`, `/core/org-chart`) and session B (committed 2026-10-27: HR time bar + `org-chart/changes`, Replay, drag to change manager, dotted-line managers, Tenure/Span). B-094 is In review via `.local-docs/agents/plans/B-094-review.md`.

Session C (committed 2026-10-28): open roles (B-128) as a Core HR `OpenRole` (title, manager, unit, target start, Open/OnHold/Filled/Closed), carried on the chart payload (`openRoles`), written via `POST/PUT /api/corehr/org-chart/open-roles`; visible to anyone who sees the manager (on hold: HR only), none on past dates; people admins add/edit from the chart's panel slot. Carthage has the canvas's two roles (`data/journey-b128-open-roles.cjs`).

**How to apply:** read the user's verdict on `plans/B-094-review.md` (sessions A–C); complaints become Ready children under B-094. Remaining org chart work: B-132. B-131 (Review progress lens) built 2026-10-28, In review: it follows Performance's review read rule (HR all, manager the reviews they write, everyone their own), not a skip-level branch.
