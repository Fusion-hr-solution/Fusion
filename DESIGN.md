# Fusion Design System — North Star

> **Status:** Draft design authority  
> **Scope:** User-facing Fusion micro-frontends that consume `packages/ds`  
> **Purpose:** Define Fusion's durable visual character, interaction philosophy, composition grammar, and cross-module design rules so the product feels deliberately designed rather than assembled from default component-library patterns.

---


# 1. Fusion design character

Fusion is a multi-module enterprise HR platform, but it must not look like a generic HR admin template.

Its visual identity is **Structured Humanism**:

> **A precise operating system for people — confident, composed, information-rich, and unmistakably human.**

This is the central design idea. Every visual and interaction decision should reinforce it.

## 1.1 The character in five traits

### 1. Confident

Fusion should have visible conviction.

- Headlines have presence.
- Primary actions are unmistakable.
- Selected states are strong enough to orient instantly.
- Important information is not buried in timid gray.
- Layouts use decisive alignment and proportion.

Confidence does **not** mean loud color, oversized typography, or visual aggression.

### 2. Human

Fusion deals with people, teams, careers, goals, and organizational relationships. It should avoid the emotional coldness of finance or infrastructure software.

Humanity should come from approachable language, comfortable reading rhythm, thoughtful empty and transition states, restrained warmth, and clear recognition of people as people rather than rows in a database.

Human does **not** mean playful, whimsical, cartoonish, or soft everywhere.

### 3. Structured

Fusion should feel intentionally organized before the user reads a word.

Structure comes from strong alignment, clear page anatomy, meaningful spacing, typography hierarchy, consistent action placement, deliberate surface levels, and predictable information patterns.

Structure should replace unnecessary containers.

### 4. Alive

Enterprise software should not feel dead. Fusion may use controlled contrast, meaningful accent, polished interaction states, subtle motion, and distinctive composition to feel contemporary and responsive.

Alive does **not** mean animated, decorative, gradient-heavy, or trendy.

### 5. Capable

Fusion must look comfortable handling serious operational complexity. Dense tables, permissions, org structures, forms, reviews, configuration, and workflows should feel native to the product rather than like exceptions bolted onto a pretty dashboard.

A screen can be dense and still look refined.

## 1.2 Fusion's visual tension

Fusion deliberately balances several tensions:

| Fusion should be | Without becoming |
| --- | --- |
| Bold | Loud |
| Human | Cute |
| Dense | Cramped |
| Refined | Precious |
| Modern | Trend-driven |
| Structured | Boxed-in |
| Professional | Corporate-stale |
| Warm | Soft or low-contrast |
| Minimal | Empty |
| Expressive | Decorative |

When a design choice pushes too far toward either extreme, correct it toward this balance.

## 1.3 Fusion's signature visual grammar

The product should become recognizable through repeated visual behaviors, not through decorative branding pasted onto generic components.

### Editorial hierarchy

Screens should have an editorial sense of hierarchy: a strong page title, clearly readable supporting layers, distinct sections, deliberate emphasis, and visible information priority. Users should be able to scan the page before reading it.

### Flat-first composition

Fusion is primarily a **flat, structured application**, not a collection of floating tiles. Prefer page rhythm, section boundaries, alignment, whitespace, and subtle tonal changes before introducing cards or elevation.

### Controlled contrast

Important elements should be allowed to look important. Fusion should use contrast deliberately between page title and body, primary and secondary actions, active and inactive navigation, primary and secondary text, canvas and meaningful surfaces, and normal and semantic states.

Avoid a UI where everything lives within the same narrow gray range.

### Softened precision

Geometry should feel precise but not severe. Corners may be softened; controls should feel polished; surfaces should remain disciplined. Pills are semantic tools, not the default shape. Excessive roundness is not part of Fusion's identity.

### Purposeful accent

Accent color is punctuation. It should create memorable moments around primary actions, selected states, meaningful focus, status or progress where semantic, and important product moments. It should not flood the interface.

### Information-first beauty

A beautiful Fusion screen should become **more understandable**, not merely more decorated. Visual polish is successful when it improves orientation, scanning, comparison, confidence, perceived quality, and task completion.

## 1.4 Signature composition behaviors

Across modules, users should repeatedly encounter a recognizable Fusion grammar.

### Strong page openings

Important pages should begin with a deliberate header composition: clear title, useful context, and properly ranked actions. The top of a page should not feel like a default `CardHeader`.

### Section-led layouts

Sections should normally be established through hierarchy and spacing rather than floating containers.

### Data with rhythm

Tables and lists should feel designed: confident headers, calm row rhythm, useful secondary information, intentional status treatment, clear row affordances, and disciplined density.

### Anchored actions

Primary actions should appear in predictable locations and retain visual priority.

### Quiet supporting UI

Filters, metadata, helper text, secondary actions, and chrome should remain quieter than the user's task.

### Deliberate moments of emphasis

Not every surface needs personality at once. Fusion should concentrate visual character in a few places per screen rather than distributing equal emphasis everywhere.

## 1.5 Emotional target

A user should ideally describe Fusion as:

> **clear, polished, confident, modern, and surprisingly pleasant for serious HR software.**

They should not describe it as:

> generic, sterile, template-like, overly soft, card-heavy, flashy, or obviously built from stock shadcn examples.

## 1.6 Product personality test

When two technically valid designs exist, prefer the one that better satisfies these questions:

- Does it look deliberately composed rather than assembled?
- Does it communicate hierarchy before decoration?
- Does it have enough contrast and presence to feel confident?
- Does it remain humane while handling serious operational work?
- Does it preserve useful density?
- Does it feel like Fusion rather than a generic component-library demo?
- Would the same visual grammar still make sense in another Fusion module?


# 2. Reference synthesis

The references below are **calibration points, not Fusion's identity**. Section 1 defines Fusion's character. These systems contribute evidence about specific problems—human trust, operational clarity, data density, and system discipline—without being blended into a generic average.

Fusion does not copy any single product. Its direction is informed by proven qualities found in strong HRIS and enterprise systems.

## BambooHR — human trust

Borrow:

- Warmth without sacrificing professional credibility.
- Friendly, understandable language.
- A product experience that feels designed for people rather than database operators.
- Personality expressed subtly through typography, color, iconography, and microcopy.

Reject:

- Excessive softness that weakens data density or authority.
- Consumer-app whimsy in serious administrative workflows.

## Rippling — unified operational clarity

Borrow:

- Strong presentation of interconnected workforce information.
- Clear actionability around employee data, permissions, workflows, reporting, and operational changes.
- Interfaces that can carry substantial information without losing hierarchy.
- A sense that modules belong to one underlying platform.

Reject:

- Overloading screens simply because more information is available.
- Making automation or intelligence the visual center when the user's task should remain primary.

## Personio — approachable process clarity

Borrow:

- Simple mental models around people data and HR workflows.
- Clear process progression.
- Straightforward administrative interfaces.

Reject:

- Generic SaaS composition that lacks a recognizable product identity.

## Atlassian Design System — system discipline

Borrow:

- Foundations, components, and patterns as separate but connected layers.
- Semantic tokens rather than arbitrary visual values.
- Strong typography and spacing hierarchy.
- Deliberate surface/elevation levels.
- Cross-product cohesion.

## Carbon Design System — data discipline

Borrow:

- Serious treatment of data tables and dense operational interfaces.
- Density as a deliberate mode rather than accidental compression.
- Predictable alignment and spacing in repeated data structures.

These references are **inputs, not templates**. Fusion must develop its own recognizable visual language.

---

# 3. Core design principles

## 3.1 Hierarchy before decoration

Every screen MUST make these questions easy to answer:

1. Where am I?
2. What is this page about?
3. What matters most?
4. What can I do here?
5. What changed or needs attention?

Hierarchy SHOULD be created in this order:

1. Position and layout
2. Typography
3. Spacing
4. Contrast and color
5. Surface treatment
6. Borders/elevation
7. Decorative treatment

Do not compensate for weak hierarchy by wrapping everything in cards.

## 3.2 One obvious primary path

Most screens SHOULD have one clearly dominant next action.

Competing primary actions are a design failure unless the workflow truly contains two equally important choices.

## 3.3 Progressive disclosure

Show what users need to understand and act first. Secondary detail SHOULD remain available without competing with primary content.

Complexity may exist in the product; it MUST NOT all demand attention simultaneously.

## 3.4 Consistency over local cleverness

A clever one-off pattern is usually worse than a strong shared pattern.

When a pattern recurs across modules, it SHOULD become a shared `packages/ds` pattern rather than being reimplemented locally.

## 3.5 Human confidence

HR software contains personal, organizational, and permission-sensitive data. The interface MUST communicate control and trust.

Friendly does not mean casual. Serious does not mean gray and lifeless.

## 3.6 The interface speaks first

Fusion SHOULD communicate through structure before explanation.

A well-designed screen should make its purpose, state, hierarchy, and available actions understandable through:

- placement and grouping
- labels and terminology
- visible state
- sensible defaults
- action availability
- progressive disclosure
- contextual feedback

Explanatory copy is a **supporting tool, not a substitute for interaction design**.

Do not add paragraphs, subtitles, helper text, banners, tooltips, or callouts merely because a screen could be explained. Add copy only when it prevents a realistic misunderstanding, supports a consequential decision, communicates information the interface cannot express structurally, or enables recovery.

If removing explanatory text makes the interface confusing, first ask whether the layout, label, control, state treatment, or workflow should be improved instead.

The user should not need to read instructions to operate an ordinary Fusion screen.

## 3.7 Choose the natural interaction, not the convenient CRUD representation

Choose the interaction that most naturally lets the user understand and complete the task—not the easiest CRUD representation to implement.

Forms, tables, cards, selects, and dialogs are tools, not default answers. Before choosing one, establish the decision being made, the relationships that must remain visible, the needed precision, the frequency and consequence of the action, and whether visible choices or direct manipulation would make the task clearer.

Use the interaction that fits the work. For example:

- Organization structure should make reporting relationships spatially legible through visual hierarchy and support direct manipulation where it is safe and useful.
- Repeated, comparable records may call for a table or bulk selection.
- Frequent, lightweight changes may call for inline editing.
- Finding a known item may call for command/search.
- Time-bound work may call for timeline manipulation.

Do not flatten these tasks into a form or table simply because those components are available. Preserve familiar, accessible conventions when they fit; invent a new pattern only when it makes the task genuinely clearer.

## 3.8 Immediate understanding and spatial clarity

Fusion should feel immediately understandable, rich, impressive, and natural. These are outcomes of a well-designed task flow—not decoration or novelty.

Where relationships, sequence, ownership, position, or containment matter, the layout and interaction MUST make them visible. A user should be able to understand the relevant spatial model before reading a detailed explanation: who reports to whom, what belongs together, what changed, what can move, and where an action will take effect.

Richness comes from showing the right context, relationships, and controls at the right moment. It does not mean showing every possible detail at once.

---

# 4. Typography philosophy

Typography is one of Fusion's primary sources of personality and hierarchy.

## 4.1 Roles, not arbitrary sizes

The design system SHOULD expose semantic typography roles such as:

- Display / major feature moment
- Page title
- Section title
- Subsection title
- Card or panel title
- Body
- Supporting body
- Label
- Helper / metadata
- Eyebrow / overline
- Metric / numeric emphasis
- Code / identifier where appropriate

Consumers MUST use semantic roles rather than inventing arbitrary font sizes and weights.

## 4.2 Hierarchy

Page titles MUST be unmistakable from section titles.

Primary and secondary text MUST be distinguishable without reducing secondary content to illegible gray text.

Boldness SHOULD come from confident scale and weight contrast, not from making every heading heavy.

## 4.3 Readability

- Ordinary operational screens SHOULD avoid long explanatory copy.
- When longer prose is genuinely necessary, it MUST remain comfortably readable and visually secondary to the task.
- Dense operational screens MAY use compact text, but never at the expense of legibility.
- Small text MUST be reserved for genuinely secondary information.
- Line lengths SHOULD remain controlled for prose-heavy content.

## 4.4 Numeric information

Important metrics, counts, percentages, and dates SHOULD use deliberate numeric styling and alignment.

Large numbers must not automatically become oversized dashboard cards.

---

# 5. Color philosophy

Color has four jobs:

1. Establish Fusion identity.
2. Create hierarchy and emphasis.
3. Communicate semantic state.
4. Clarify interaction.

It MUST NOT become decorative noise.

## 5.1 Brand color

The primary brand/accent color SHOULD be recognizable across modules but used selectively.

Brand color SHOULD emphasize:

- primary actions
- selected navigation
- meaningful focus
- key interactive states
- occasional high-value emphasis

It SHOULD NOT color every heading, border, icon, and card.

## 5.2 Semantic color

Success, warning, danger, and informational colors MUST be semantic and consistent.

Semantic meaning MUST NOT depend on color alone.

## 5.3 Neutral hierarchy

Fusion needs a deliberate neutral system for:

- canvas
- default surfaces
- secondary surfaces
- borders
- primary text
- secondary text
- muted text
- disabled states

Neutral does not mean visually flat. Contrast between these roles MUST remain perceptible.

---

# 6. Spacing and whitespace

Spacing is structural information.

Fusion SHOULD use a limited spacing scale owned by `packages/ds`.

## 6.1 Whitespace communicates relationships

Use tighter spacing to show belonging and larger spacing to show separation.

Do not use identical vertical gaps everywhere.

A page SHOULD have visible rhythm:

- page-level separation
- section-level separation
- component-level separation
- control-level separation

## 6.2 Optical balance

Token consistency does not prohibit visual judgment.

Optical adjustments MAY be made using approved spacing values where typography, icons, or unusual geometry create visual imbalance.

## 6.3 No accidental whitespace

Large empty areas must have a reason.

"Premium" does not mean making enterprise screens unnecessarily sparse.

---

# 7. Density

Fusion's default density is **comfortable-compact**.

The system must support data-rich HR work without feeling cramped.

## 7.1 General rule

- Marketing-like spaciousness is inappropriate for ordinary operational screens.
- Spreadsheet density is inappropriate for ordinary forms and settings.
- Tables and repeated data MAY be denser than forms and explanatory content.

## 7.2 Density follows task type

### Data exploration
Prefer compact, scan-friendly presentation.

### Configuration
Prefer moderate density with strong grouping.

### Guided setup
Prefer more breathing room and progressive disclosure.

### Employee/self-service
Prefer approachable, readable composition.

Density MUST be intentional, not a side effect of whichever shadcn component was inserted.

---

# 8. Surface hierarchy and elevation

Fusion MUST have a clear surface model.

Conceptually:

1. **Canvas** — application/page background.
2. **Default surface** — normal working content.
3. **Grouped/subtle surface** — quiet contextual grouping.
4. **Raised surface** — deliberately emphasized or movable content.
5. **Overlay surface** — dialogs, menus, popovers, temporary layers.

## Rules

- Default content SHOULD remain relatively flat.
- Whitespace and typography SHOULD be preferred over borders and shadows for basic grouping.
- Raised surfaces MUST be intentional.
- Shadows SHOULD indicate layering, not decorate static boxes.
- Overlays MUST visually separate from the content beneath them.
- Nested elevation SHOULD be rare.

---

# 9. Card philosophy

Cards are not the default layout primitive.

A card SHOULD represent one of these:

- an independent conceptual object
- a bounded summary
- a selectable item
- a movable/reorderable object
- a genuinely distinct surface
- a dashboard element that benefits from separation

A card SHOULD NOT be used merely because a group of content needs spacing.

## Avoid card soup

Do not produce:

- card inside card inside card
- every settings section as a separate floating card
- every metric in an oversized tile
- every table inside a decorative container
- pages made of equal-weight white rectangles

Prefer:

- section hierarchy
- dividers
- alignment
- whitespace
- subtle background grouping

Cards SHOULD earn their visual weight.

---

# 10. Borders, radius, and shadows

Exact values belong to `packages/ds`; this document defines intent.

## Border radius

Fusion SHOULD feel modern and refined without becoming excessively pill-shaped or toy-like.

- Controls SHOULD share a coherent radius family.
- Large surfaces MAY use slightly more radius than compact controls.
- Pills SHOULD be reserved for semantics that genuinely benefit from capsule geometry: tags, statuses, compact filters, segmented choices.
- Arbitrary local radius values MUST NOT be introduced.

## Borders

Borders SHOULD clarify structure, state, or separation.

Do not border every container.

## Shadows

Shadows SHOULD primarily communicate actual elevation.

Heavy or decorative shadows are not part of the default visual language.

---

# 11. Navigation philosophy

Navigation must make the multi-module platform understandable.

Users SHOULD always understand:

- current module
- current location within the module
- primary navigation options
- how to return to the previous conceptual level
- whether a navigation item is selected
- where account/tenant-level actions live

## Rules

- Persistent product navigation MUST remain visually stable across MFEs.
- Module navigation MUST use shared patterns.
- Active state MUST be unmistakable.
- Breadcrumbs SHOULD appear when hierarchy is meaningful, not automatically on every page.
- Tabs SHOULD switch between sibling views, not behave as disguised navigation to unrelated areas.
- Back buttons MUST represent a meaningful workflow/back relationship.
- Critical navigation MUST NOT depend on hover-only discovery.

---

# 12. Page anatomy

Common pages SHOULD follow recognizable product patterns.

A standard operational page generally contains:

1. Context / breadcrumb when needed
2. Page header
3. Title; supporting description only when it adds information the title and surrounding structure cannot
4. Primary action and limited secondary actions
5. Optional status/context
6. Filters or local navigation when needed
7. Main working content
8. Pagination, supporting detail, or contextual actions

The exact composition MAY vary, but agents MUST not invent a new page structure for every feature.

Page titles do not require explanatory subtitles by default. Do not repeat the title in sentence form, describe obvious controls, or narrate what the user can already see.

Shared page patterns SHOULD eventually be encoded in `packages/ds`.

---

# 13. Action and button hierarchy

Buttons express priority.

## Primary

- Represents the page or step's dominant forward action.
- SHOULD normally appear once in a local decision area.
- MUST be visually dominant.

## Secondary

- Important but not dominant.
- MAY appear alongside the primary action.

## Quiet / tertiary

- Contextual or low-priority actions.
- SHOULD not compete with the main task.

## Destructive

- Reserved for destructive or materially risky actions.
- MUST NOT be used merely to attract attention.
- SHOULD be separated from ordinary actions where practical.

## Icon-only actions

- MUST have accessible names/tooltips where appropriate.
- SHOULD be used only when the icon is conventional and space efficiency matters.

Do not create a row of equally styled buttons and force users to determine priority from wording alone.

---

# 14. Forms philosophy

Forms should feel guided, not bureaucratic.

## Structure

- Related fields MUST be grouped meaningfully.
- Labels MUST remain visible; placeholders are not labels.
- Required/optional behavior MUST be clear and consistent.
- Helper text SHOULD explain genuine ambiguity, constraints, or consequences; it MUST NOT restate the label or narrate obvious input behavior.
- If a field repeatedly needs helper text to be understood, reconsider the label, control type, grouping, or workflow first.
- Validation SHOULD appear near the affected field.
- Cross-field or form-level errors SHOULD appear where the relationship is understandable.

## Long forms

Long forms SHOULD use:

- sections
- progressive disclosure
- steps when genuine sequential commitment exists
- sticky or consistent action placement where appropriate

Do not split a short form into a wizard merely to make it feel designed.

## Actions

Save/submit/cancel behavior MUST be consistent across modules.

Users MUST understand whether changes are:

- saved immediately
- staged locally
- submitted for approval
- destructive
- reversible

---

# 15. Tables and data-heavy UI

Data-heavy interfaces are first-class Fusion experiences, not fallback layouts.

## Principles

- Optimize for scanning.
- Align comparable information consistently.
- Keep row height intentional.
- Prioritize useful columns over exhaustive columns.
- Support sorting/filtering/search only where they help real tasks.
- Use status, badges, icons, and secondary text sparingly.
- Numeric data SHOULD align predictably.
- Row actions SHOULD be discoverable without overwhelming each row.
- Bulk actions MUST appear only when selection makes them relevant.

## Tables vs cards

Repeated structured entities SHOULD generally use a table/list rather than a grid of oversized cards when comparison is important.

This rule does not make a table the default for every collection. When hierarchy, sequence, relationships, or direct manipulation are central to the task, use the representation that makes those qualities visible instead.

## Dense information

Progressive disclosure is preferred to horizontal sprawl.

Details MAY open in a dedicated page, panel, expandable row, or dialog depending on task depth.

---

# 16. Search, filtering, and views

Search and filtering should reduce cognitive load.

- Global search, module search, and table search MUST not look interchangeable if they have different scope.
- Filters SHOULD expose active state clearly.
- Applied filters MUST be easy to inspect and clear.
- Frequently used filters MAY remain visible.
- Advanced filters SHOULD use progressive disclosure.
- Saved views MAY be introduced where repeated operational workflows justify them.
- Empty results caused by filtering MUST be distinguishable from truly empty datasets.

---

# 17. Feedback and system states

Every asynchronous or stateful experience MUST account for:

- loading
- empty
- no-results
- success
- warning
- error
- partial failure when applicable
- disabled/unavailable
- permission denied when applicable

## Loading

Use the least disruptive representation that preserves context.

- Inline action → local progress.
- Replacing structured content → skeleton may be appropriate.
- Full-page spinner → last resort.

Avoid fake complexity in skeletons.

## Empty states

Empty states MUST make the absence understandable without turning into mini help pages.

Use the minimum copy needed for the situation. When context is already obvious, a concise state label and a relevant action may be enough.

When clarification is genuinely needed, an empty state MAY answer:

- why nothing is shown
- what belongs here
- what the user can do next

Do not explain the product, repeat the page purpose, or add motivational filler merely to fill empty space.

An empty state SHOULD not become an oversized illustration or paragraph-heavy composition that dominates an enterprise workflow.

## Errors

Errors MUST be actionable where possible.

Avoid generic "Something went wrong" when the system can provide a meaningful recovery path.

## Success

Routine successful actions SHOULD generally use lightweight confirmation.

Do not interrupt users with success dialogs for ordinary operations.

---

# 18. Confirmation and destructive interactions

Confirmation is for consequential decisions, not every button click.

Use a confirmation step when an action is:

- destructive
- difficult or impossible to reverse
- high-impact
- security/permission sensitive
- likely to surprise the user

Prefer undo when a safe, understandable undo model exists.

Confirmation copy MUST name the action and consequence.

Avoid vague prompts such as:

> Are you sure?

Prefer concrete consequences.

---

# 19. Dialogs, drawers, and overlays

Use overlays according to task depth.

## Dialog

Best for:

- confirmation
- focused short tasks
- small decisions
- compact creation/editing

## Drawer / side panel

Best for:

- contextual detail
- quick inspection
- lightweight editing without losing list context

## Dedicated page

Best for:

- deep workflows
- complex editing
- substantial information
- tasks requiring navigation or multiple sections

Do not force complex forms into dialogs simply because shadcn makes dialogs easy to create.

---

# 20. Status and semantic indicators

Status presentation MUST be consistent across modules.

Badges SHOULD be reserved for compact semantic labels such as:

- lifecycle state
- approval state
- risk state
- category/tag when visually useful

Do not badge ordinary text.

Status color MUST have a textual or iconographic cue where meaning matters.

Important state SHOULD not disappear into muted metadata.

---

# 21. Iconography

Icons should increase recognition and reduce scanning cost.

- Use one coherent icon family unless an intentional exception exists.
- Similar actions MUST use the same icon across modules.
- Decorative icon usage SHOULD be restrained.
- Icons MUST NOT substitute for clear labels in unfamiliar workflows.
- Icon size, stroke weight, and alignment SHOULD remain consistent.
- Large illustrated icons SHOULD be reserved for meaningful empty/onboarding moments.

---

# 22. Motion philosophy

Motion should explain change, preserve orientation, or provide feedback.

Use motion for:

- expansion/collapse
- overlays entering/leaving
- state transitions
- reordering
- progress
- spatial relationships

Do not animate merely to make the interface feel "premium."

## Character

Motion SHOULD feel:

- quick
- controlled
- subtle
- physically coherent

Avoid:

- slow decorative transitions
- excessive spring/bounce
- unrelated elements animating simultaneously
- animation that delays interaction

Reduced-motion preferences MUST be respected.

---

# 23. Responsive behavior

Desktop is an important Fusion environment, but responsive behavior must be deliberate.

When space decreases:

1. Preserve the primary task.
2. Preserve critical actions.
3. Reflow before shrinking text.
4. Collapse secondary controls where appropriate.
5. Allow tables to adapt intentionally rather than simply clipping unpredictably.
6. Avoid hiding essential information behind unexplained icons.

Responsive behavior SHOULD be defined in shared patterns where possible rather than solved differently by every MFE.

---

# 24. Accessibility

Accessibility is part of the design system, not a cleanup pass.

At minimum:

- keyboard navigation MUST work
- focus MUST remain visible
- semantic HTML SHOULD be preferred
- controls MUST have accessible names
- color contrast MUST meet accepted accessibility standards
- interaction state MUST not rely on color alone
- hit targets MUST remain usable
- heading hierarchy SHOULD reflect information hierarchy
- disabled state and read-only state MUST be distinguishable
- reduced-motion preferences MUST be respected

Accessible behavior already provided by Radix/shadcn primitives MUST not be broken by visual customization.

---

# 25. UX writing

Fusion uses **product language, not assistant language**.

Copy should feel written by a precise product team, not generated by an AI, a marketing site, a support bot, or a tutorial narrator.

Fusion copy should be:

- concise
- specific
- factual
- calm
- human
- professional
- action-oriented
- grounded in the user's domain

## 25.1 Structure before copy

The UI SHOULD communicate most meaning through hierarchy, labels, state, controls, defaults, and action placement.

Copy MUST NOT compensate for weak information architecture or unclear interaction design.

Do not add text merely to make a screen feel complete.

Avoid:

- a descriptive paragraph under every page title
- helper text under self-explanatory fields
- banners that restate visible state
- tooltips for obvious controls
- prose that narrates the workflow step by step
- empty-state paragraphs that repeat the page purpose
- repeated explanations of concepts the user has already acted on

If a sentence can be removed without reducing understanding, confidence, safety, or recovery, remove it.

## 25.2 Natural product voice through the journey

Avoid assistant-like, generated, promotional, or conversational filler.

Fusion may speak directly and naturally to the user when contextual guidance, a transition, feedback, or recovery genuinely helps them move through a journey. That voice should be plain, specific, and proportional to the moment: acknowledge what happened, clarify what matters now, and make the next useful action clear.

Do not mistake natural language for chatty language. The product should not narrate obvious steps, simulate a conversation, or use enthusiasm to compensate for weak interaction design.

Do not write product UI in the style of:

- “Let’s get started”
- “Here’s what you can do”
- “You’re all set!”
- “Easily manage…”
- “Seamlessly streamline…”
- “Unlock powerful…”
- “Take control of…”
- “We’ve made it simple to…”

Avoid inflated adjectives and vague claims such as `powerful`, `seamless`, `smart`, `intuitive`, `robust`, or `effortless` unless they convey necessary factual meaning.

Do not address the user conversationally when a direct label, state, or action is clearer. When a human sentence does add useful context, write it as the product speaking clearly at the right moment—not as an assistant performing friendliness.

Warmth should come from clarity, considerate wording, and respectful handling of people—not chatty filler.

## 25.3 Terminology

Prefer the user's domain language over implementation language.

- Name people, objects, states, and actions consistently.
- Prefer concrete nouns and verbs.
- Do not expose DTO, API, service, database, permission-internal, or orchestration terminology unless it is genuinely part of the user's mental model.
- Do not invent synonyms merely to avoid repetition; consistency is more valuable.

## 25.4 Buttons and actions

Prefer explicit verbs and name the real outcome:

- `Add employee`
- `Save changes`
- `Send invitation`
- `Approve objectives`

Avoid ambiguous labels such as:

- `OK`
- `Yes`
- `Submit` when the actual outcome can be named
- `Continue` when the next action can be named
- `Confirm` when the action itself can be named

Button copy SHOULD describe what will happen, not merely acknowledge the interface.

## 25.5 Labels, descriptions, and helper text

Labels SHOULD carry the meaning whenever possible.

Descriptions and helper text are justified when they communicate:

- a non-obvious constraint
- a consequential effect
- a distinction users could realistically misunderstand
- information required before making a decision

They are not justified merely because a component supports a `description` prop.

Do not restate labels in longer sentences.

## 25.6 Errors

Errors should state, as concisely as the situation allows:

1. what happened
2. what it affects, when relevant
3. what the user can do, when known

Prefer factual language over apology or drama.

Avoid generic “Something went wrong” when a meaningful state or recovery path is known.

## 25.7 Empty states

Explain only what is not already apparent.

A good empty state may be as small as:

- a precise state label
- one short clarifying sentence when needed
- one relevant next action

Do not turn empty states into product explanations, onboarding copy, motivational copy, or marketing.

## 25.8 Confirmations and warnings

Use copy proportional to consequence.

Warnings and confirmations MUST name the real risk or result. Do not add cautionary text merely to make an action feel important.

Routine actions should not receive ceremonial copy.

## 25.9 Tone

Fusion should never sound:

- robotic
- AI-generated
- promotional
- patronizing
- excessively cheerful
- cute
- vague
- legally defensive in ordinary workflows
- verbose for the sake of appearing helpful

The strongest Fusion copy often disappears into the interface because the interaction already makes the meaning obvious.

---

# 26. Permissions and trust-sensitive UX

Permission-sensitive experiences are especially important in a multi-tenant HR platform.

- Unauthorized actions SHOULD not be presented as ordinary available actions that fail only after submission.
- Disabled actions SHOULD be used only when seeing the unavailable capability helps understanding; otherwise hide what the user should not meaningfully interact with.
- Sensitive actions SHOULD expose enough context for users to understand impact.
- Tenant context MUST never be visually ambiguous where cross-tenant mistakes could matter.
- Role and permission information SHOULD use clear human language rather than implementation terminology.
- Security-sensitive confirmation MUST prioritize clarity over visual minimalism.

---

# 27. Multi-module consistency

The shell and MFEs form one product.

The following MUST be shared or governed centrally wherever practical:

- typography roles
- color semantics
- spacing scale
- radii
- elevation
- navigation states
- button hierarchy
- form behavior
- validation
- tables
- statuses
- dialogs
- loading/error/empty patterns
- page headers
- common detail/list/settings compositions

Modules MAY have contextual character through their data, workflows, illustrations, or limited accent treatments.

They MUST NOT develop independent visual systems.

---

# 28. Design-system expression

`packages/ds` should evolve beyond a library of low-level shadcn components.

Fusion's design language should be expressible through progressively richer layers:

```text
Design foundations / tokens
        ↓
Accessible primitives
(shadcn / Radix where useful)
        ↓
Fusion components
        ↓
Fusion product patterns
        ↓
MFE screens and flows
```

## Primitives

Primitives solve low-level interaction and accessibility.

They are not the visual identity.

## Fusion components

Shared components SHOULD embody Fusion's styling and interaction defaults.

Consumers should rarely need significant local restyling.

## Product patterns

Repeated compositions SHOULD become shared patterns, for example:

- PageHeader
- ListPage structure
- FilterBar
- DataTable composition
- DetailSection
- SettingsSection
- EmptyState
- Status treatment
- destructive confirmation
- form section
- setup/wizard shell

The goal is not to prohibit composition. The goal is to stop each MFE from redesigning common product grammar.

---

# 29. Relationship with shadcn

shadcn is an implementation accelerator, not Fusion's design identity.

Fusion MAY use shadcn/Radix primitives for:

- accessibility
- interaction behavior
- component foundations
- implementation speed

Fusion MUST NOT accept default shadcn composition or styling merely because it is available.

Agents and developers SHOULD prefer:

1. existing Fusion pattern
2. existing Fusion component
3. approved primitive
4. new shared pattern/component when the need is recurrent
5. local one-off composition only when the requirement is genuinely local

"shadcn default" is not a design decision.

---

# 30. Character enforcement

A screen can follow every generic usability best practice and still fail to feel like Fusion.

Before accepting a design, verify that it expresses several of Fusion's signature traits:

- editorial hierarchy
- flat-first composition
- controlled contrast
- softened precision
- purposeful accent
- disciplined density
- strong data presentation
- quiet supporting UI
- deliberate moments of emphasis

If the result is merely clean, accessible, and functional but could belong to any shadcn-based admin product, it is **not finished**.

Do not add arbitrary decoration to solve this problem. Strengthen the underlying composition, typography, contrast, proportions, interaction states, and shared patterns instead.

---

# 31. What Fusion must never look like

Fusion MUST NOT degrade into:

## Generic shadcn admin UI

Symptoms:

- every section is a bordered card
- default component examples copied directly into product screens
- weak page hierarchy
- generic black/white/gray styling with one default accent
- no visual distinction between modules, sections, actions, or information priority

## AI-generated SaaS aesthetic

Avoid:

- gratuitous purple/blue gradients
- enormous rounded cards
- excessive glass effects
- hero-sized headings in operational screens
- random glowing accents
- icon-filled decorative tiles
- every section centered
- marketing-layout composition inside application workflows

## AI-generated product voice

Avoid:

- explanatory subtitles under every heading
- generic “helpful” paragraphs that narrate obvious UI
- assistant-like phrases such as “Let’s…”, “Here’s…”, or “You’re all set”
- promotional SaaS language inside operational workflows
- repeated reassurance, filler, or feature narration
- verbose empty states, helper text, banners, and confirmations
- copy that explains a weak layout instead of fixing it

Fusion should read like a designed product, not a conversation with an assistant.

## Enterprise gray soup

Avoid:

- timid contrast
- everything the same neutral shade
- tiny typography everywhere
- borders around every group
- no meaningful accent
- visual seriousness confused with visual dullness

## Card soup

Avoid:

- cards inside cards
- dashboards built entirely from equal tiles
- settings pages where every field group floats independently
- using cards instead of layout hierarchy

## Density extremes

Avoid both:

- oversized, empty interfaces that waste working space
- compressed spreadsheet-like screens without breathing room or grouping

## Component improvisation

Avoid:

- local button variants
- arbitrary radii
- arbitrary shadows
- custom badge semantics
- random spacing
- ad hoc page headers
- duplicate empty states
- independent MFE color systems

## Weak interaction hierarchy

Avoid:

- five equally prominent actions
- hidden critical actions
- destructive actions next to safe actions without separation
- icon-only controls for unfamiliar actions
- success modals after routine actions

---

# 32. Design review questions

Before considering a screen complete, review it against these questions.

## Hierarchy

- Can a user understand the page in a few seconds?
- Is the title clearly dominant?
- Is supporting information visibly secondary?
- Is the main task obvious?
- Are hierarchy, sequence, ownership, and containment spatially clear where they matter?

## Composition

- Are we using cards because they are justified?
- Could whitespace or section hierarchy replace a container?
- Does the page have intentional visual rhythm?
- Is density appropriate for the task?

## Actions

- Is there a clear primary action?
- Are destructive actions treated appropriately?
- Are secondary actions visually secondary?
- Does the interaction fit the user's task better than the most convenient CRUD control would?
- Would visible choices, inline editing, bulk selection, search/command, timeline editing, or direct manipulation make the work clearer?

## Data

- Is repeated data easy to scan and compare?
- Are filters and states understandable?
- Are important statuses visible without becoming noisy?

## States

- Are loading, empty, no-results, error, and success states covered?
- Does the user understand what happened and what to do next?

## System consistency

- Are we using `packages/ds`?
- Are we reusing an established Fusion pattern?
- Have we introduced an arbitrary visual value or local variant?
- Would this screen feel at home beside another Fusion module?

## Language and self-explanation

- Does the interface make sense before reading supporting prose?
- Is every description, helper line, tooltip, banner, and callout earning its space?
- Can any explanatory sentence be removed by improving the label, layout, state, control, or action?
- Does the copy sound like product language rather than AI, marketing, support, or tutorial language?
- Are we repeating information already visible elsewhere on the screen?
- Are consequential details explicit while obvious details remain unstated?
- When the journey benefits from a human sentence, does it give specific, timely guidance without becoming chatty or assistant-like?

## Visual character

- Does this look deliberately designed?
- Is there enough hierarchy and confidence?
- Does it avoid generic shadcn composition?
- Does it avoid generic AI/SaaS styling?
- Is personality coming from disciplined design rather than decoration?
- Does it feel immediately understandable, rich, impressive, and natural because the task and its relationships are clear?

---

# Appendix A — Reference basis (informative, non-normative)

This north star was synthesized from patterns and principles visible in:

- **BambooHR** — human, warm, trustworthy HR product design.
- **Rippling** — unified workforce platform, dense operational data, permissions, workflows, and cross-module consistency.
- **Personio** — approachable HR workflows and centralized people-data experiences.
- **Atlassian Design System** — foundations → components → patterns, semantic tokens, typography hierarchy, spacing, and deliberate elevation.
- **IBM Carbon Design System** — disciplined data-table structure and density.
- **Material Design** — consistent interaction states and accessibility-aware state communication.

These systems are references for reasoning, not visual templates. Fusion should borrow proven principles while maintaining its own identity.
