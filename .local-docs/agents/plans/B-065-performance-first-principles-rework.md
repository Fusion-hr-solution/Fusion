# B-065 — Performance, rebuilt from first principles

**Status:** Ready, not started (2026-10-15). The user is moving this work from Codex to Claude; when to start is the user's call.

## Outcome

A complete Performance module that fits naturally into the rest of Fusion: clean, coherent, ready to demo and impressive. It should tell one HRIS story with Core HR and the shell, not read as a separate app.

**Target:** the final graduation demo. Nothing comes after it, so every part is built complete; no MVP-first ordering, no "later".

**Visual bar:** BambooHR's friendliness, layouts and professionalism, without newspaper density (walls of text, ruled columns, editorial type). Fusion's DS and `DESIGN.md` stay the system; BambooHR is the feel to aim for.

## Why

`establish-performance-target-state` is implemented and archived (`openspec/changes/archive/2026-10-15-establish-performance-target-state/`), but the user doesn't trust the work Codex did:
- **Drift.** Authority was spread across a long research-generated target-state document, supporting research, an older spec, a dossier and the code. Gaps were filled from existing code.
- **Bare-bones UI.** The newer surfaces don't match the Performance surfaces built so far.
- **Frontend rework after the fact.** Contracts were fixed before anyone decided what each role sees in each state, so the UI took the shape of the endpoints.

## Scope

Everything is open. The rework starts from first principles, not from the current board.
- **Heaviest:** Reviews (rounds, assessments, results), Calibration, Overview and Update Requests. The user rejected these surfaces.
- **Presumed sound, but checked in the interview:** the Cycle & Goals spine (cycle, plan, objectives, progress) and the reference surfaces below.
- **Integration with the rest of Fusion is in scope:** the worker profile and People, the org structure, shell navigation (B-001), notifications (B-002), and anything else the HRIS story needs.
- **Existing board items** (B-003, B-004, B-005, …) are candidates. The decisions stage absorbs or drops them. Work that isn't on the board yet is expected.
- **Settings comes last on purpose.** Each feature adds its settings to `/performance/settings` with working but plain UI. The page gets one redesign at the end: it stays a single surface, so reworking it late is cheap. Surfaces that features share can't be reworked late that way.

## Roles

- **Agent:**
  - owns the product knowledge of what a mature performance module has;
  - owns the architecture, domain model, contracts, implementation, and the design of surfaces and how they interact;
  - proposes these with reasoning and doesn't ask the user implementation questions.
- **User:** agrees the feature set beyond the core, the nice-to-haves and the wow features, from the agent's recommendations; makes taste and business-priority calls; accepts or rejects proposals.

## Feature catalogue (part of B-068)

The agent prepares one catalogue in three tiers:
- **Core:** what every mature performance product has.
- **Add-ons:** worthwhile nice-to-haves.
- **Wow features:** ideas that impress in a demo and make sense for Fusion.

Sources are established products (Lattice, Culture Amp, 15Five, Betterworks, Workday, SAP SuccessFactors) plus brainstorming specific to Fusion. The AI-assisted org import in Core HR is the model for that kind of idea. For each entry: what it is, who it serves, where it lives, its cost, and the agent's recommendation. The user picks.

## Surface architecture first (part of B-069)

The hard part is shared surfaces, not single screens. Before any screen is designed, settle:
- which surfaces exist: workspaces, records (person, plan, objective, review, round), drawers and attention items;
- which features compose into which surface;
- how surfaces hand off to each other;
- how each surface changes by role and by Cycle/process state;
- where Performance shows up inside Core HR and the shell.

Then a role × state matrix per surface, then screens. The design doesn't depend on any one demo story (D-41); the B-072 storyline is a test case.

**The agent makes these decisions; they aren't put to the user as questions.** The user reviews the result as concrete walkthroughs (this role, in this state, sees this and goes there) and judges how it feels, not how it's built.

## Authority (once the decisions document exists)

1. **The B-065 decisions document** is the only product authority for what it covers. Each decision has an ID, and only what the user accepted goes in.
2. **`openspec/specs/performance-*`** describe the system as built. New changes replace their requirements explicitly.
3. **Research** is input only: `.local-docs/specs/performance/target-state/*` and the archived [B-027 analysis](../archive/plans/B-027-performance-target-state-implementation-analysis.md). `refined-target-state.md` is no longer final authority.
4. **Existing code** is evidence of what exists. Where it contradicts a decision, the agent flags it and never silently keeps or drops it.

## Stages

1. **B-067 Inventory:** the whole module plus its integration points with Core HR and the shell: what exists per area and role, the reference surfaces, and every open finding below.
2. **B-068 Decisions:** product research, the feature catalogue, the interview, then the decisions document.
3. **B-069 Design:** surface architecture, then role × state matrices, then screens on the reference patterns. Approved before contracts.
4. **B-070 Implementation:** small OpenSpec changes in dependency order, each built end to end (contracts, backend, UI in every state). Each change cites decision IDs and is accepted before the next starts.
5. **B-071 Settings consolidation:** one redesign of `/performance/settings` once the features are settled.

## Implementation slices (B-070, agreed 2026-10-15)

Each slice is one OpenSpec change. It's built end to end (contracts, backend, UI in every state, tests) and cites the D-IDs it implements. It ends with screenshots of the real screens for the user's taste check. The next slice starts only after that.

1. **Fusion frame** (OpenSpec `establish-fusion-frame`): work items and notifications contracts (D-29, D-30), the bell in every module, Fusion home (D-31), Core HR profile Performance view, the Performance person page and `@repo/performance-ui` (D-32, S-05).
2. **Objectives and plans**, split on 2026-10-16 to keep each change small:
   - **2a, plan and objective pages:** objective status (D-05), change requests (D-09), update requests rebuilt (D-11), development section (D-34, S-08), plan side panel in every state (D-08). Design from the established My Plan and drawer (`B-069-screens/reference/`, the PlanDrawer board for status); extend them, don't redraw.
   - **2b, AI and alignment:** shared AI transport moved to SharedKernel (D-26), AI objective coach (D-07), alignment map (D-06, S-15).
3. **Conversations:** 1:1s (D-12), feedback and requests (D-13), praise (D-14), Feedback workspace (S-12).
4. **Reviews:** due dates and reminders (D-02, D-03), rounds (D-15, S-09), review record (D-16, D-17, S-10), peer input (D-18), questions (D-19), acknowledgement (D-20), PDF (D-21), results and history (D-22).
5. **Calibration and AI drafts:** workspace (D-23, S-11), nine-box (D-24), insights (D-25), review draft and self starter (D-27, D-28).
6. **Overview, My Team and HR insights:** Overview (C11, S-14), My Team (S-02), cycle Insights (D-33, S-16).
7. **Demo presets:** Development-only seeder and scenario presets (D-40, D-41).

Then B-071, the Settings redesign.

Design references:
- [decisions](B-068-decisions.md)
- [architecture](B-069-surface-architecture.md)
- screens canvas https://claude.ai/artifact/ASwfRfh2gzP5idrS8qtfXY
- reference screenshots in `B-069-screens/reference/`

## Reference surfaces (the bar)

My Plan (plan-object workspace and execution), the reviewer plan view, the Team "Your People" roster and cycle setup (guided flow, Population, Review). Doctrine: `DESIGN.md`, document + sidebar layout, the surface tone ladder and the data-table kit. The rejected Team summary strip (B-041) stays out.

## Inputs: open findings

- **B-057:** Update Requests on My Plan is ugly. "Choose objective" only scrolls to a list that is already visible, and the product has no objective picker. The block in the objective progress drawer is poor. The manager request entry and dialog are poor, and the dialog overflows horizontally at 592px.
- **B-060:** a blocked launch (one Active round per Cycle) shows a generic "conflicts… refresh" error.
- **B-064:** round due dates are optional with no tenant defaults, although the spec requires them. Date inputs cap at review-period end; the API doesn't.
- **Walkthrough notes:**
  - The round creation page, Draft setup and effective-settings visibility were all called poor.
  - Date entry was awkward.
  - Launch confirmation doesn't show the settings it freezes.
  - New UI in general is "ugly".
- Full notes: [B-045 walkthrough](../archive/plans/B-045-openspec-ui-workstream.md). The B-010 manual checklist in that file is a ready-made set of role/state scenarios for B-069.

## Environment

Carthage Digital Group fixture (see [data/README.md](../data/README.md)): 100 employees, 6 personas, an active FY2027 Cycle with 99 participants, Draft/Submitted/Approved plans and no review rounds. Use it for the inventory and for exploring.
