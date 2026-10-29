---
name: presentation-diagrams
description: Where the progress-presentation diagrams live and which tool renders each (Mermaid vs PlantUML)
metadata: 
  node_type: memory
  type: project
  originSessionId: 72ed5d92-5e32-463f-8e3f-813984821340
---

Progress-presentation diagrams for Core HR + Identity live in `.local-docs/diagrams/` (gitignored, local-only). Four diagrams: use case, class, sequence, logical architecture. Textual descriptions are in `.local-docs/presentation-diagrams.md`; editable diagram source is in `.local-docs/diagrams/sources.md`.

Tooling:
- **Diagrams 2–3 (class, sequence): Mermaid.** The claude-mermaid MCP server was removed on 2026-10-06; render with the Mermaid CLI (`npx @mermaid-js/mermaid-cli`) if needed.
- **Diagrams 1 (use case) & 4 (logical architecture): PlantUML** — use case needs it for stick-figure actors / ellipses; architecture looks cleaner in PlantUML than the Mermaid layered attempt. Sources: `usecase.puml`, `architecture.puml`. Render with PlantUML 1.2026.6 + Smetana layout (no Graphviz): `java -jar plantuml.jar -tsvg <file>.puml`. The jar is fetched from Maven Central into the session scratchpad (not persisted) — re-download when needed.

Versioning convention for these (per user): flat `-v0` sibling copies (e.g. `01-use-case-v0.svg`), no nested folders.

**Why:** audience is an academic PFE jury (one mildly-technical member) — diagrams must be clean and readable, not over-technical.
