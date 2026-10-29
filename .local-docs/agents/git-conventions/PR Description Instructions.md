!IMPORTANT use only technical and product terminology. Never mention OpenSpec, agents, AI tools, prompts, skills, packets, phases, or other local planning and workflow machinery.

# Pull Request Description Instructions

Generate a clear PR description based strictly on the implemented changes.

The description must explain what the PR does without documenting every implementation detail or repeating commit messages.

Choose the format based on the PR scope.

## Format Selection

Use the **Focused PR Format** when the PR:

- Has one clear purpose.
- Changes a small or closely related set of files.
- Is limited to one feature, fix, module, or technical concern.
- Can be accurately explained with a few concise points.

Use the **Large-Scope PR Format** when the PR:

- Spans multiple modules, applications, packages, or architectural layers.
- Includes both backend and frontend changes.
- Changes many files across distinct areas.
- Introduces infrastructure, authorization, shared utilities, or cross-cutting behavior.
- Cannot be explained clearly without grouping changes by area.

Do not use the large-scope format merely because the implementation is technically complex. Prefer the focused format whenever the PR still has a small, cohesive scope.

---

# Focused PR Format

## What

[Briefly explain what this PR enables, changes, or fixes and why it matters.]

## Changes

- **[Change]** — [Brief explanation.]
- **[Change]** — [Brief explanation.]

Keep this format concise. Include only information needed to understand and review the PR.

---

# Large-Scope PR Format

## What

[Briefly explain what this PR enables, changes, or fixes and why it matters.]

## Changes

### [Area — e.g. Backend]

- **[Feature or change]** — [What was added or changed.]
- **[Feature or change]** — [Important behavior, authorization, validation, or API impact.]

### [Area — e.g. Frontend]

- **[Component or feature]** — [What it does and where it is used.]
- **[UI or workflow change]** — [Describe the main user-facing behavior.]
- **[Access or state handling]** — [Mention permissions, loading, error, or read-only states.]

### [Area — e.g. Shared Packages]

- **[Utility, type, or API change]** — [Describe new or updated shared behavior.]
- **[Tests]** — [Mention the main coverage added or updated.]

Only include areas that were actually changed. Add, remove, or rename sections to match the implementation.

## Files Changed by Area

| Area             | Files | Key files          |
| ---------------- | ----: | ------------------ |
| [Backend area]   |   [#] | `[file]`, `[file]` |
| [Frontend area]  |   [#] | `[file]`, `[file]` |
| [Shared package] |   [#] | `[file]`, `[file]` |

The **Files** column must contain the total number of changed files in that area.

Include only the most important files in the **Key files** column. Do not attempt to list every modified file.

---

# General Rules

- Derive the description from the actual diff and implemented behavior.
- Focus on reviewer-relevant behavior, decisions, and impact.
- Keep wording factual, direct, concise, and simple.
- Group related changes instead of listing changes file by file.
- Do not include line counts.
- Do not exaggerate or claim behavior that was not implemented.
- Do not include empty sections or placeholder text in the final PR body.
- Mention tests only when they were added, updated, or executed.
- Use backticks for file names, routes, types, commands, and code identifiers.
- Prefer the focused format when uncertain.
