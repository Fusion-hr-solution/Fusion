---
name: i18n-speed-mode
description: "From 2026-10-26 internationalization (B-119 Performance FR, B-115 Arabic) is finish-fast — working FR/AR, few demo screens, no polish"
metadata:
  node_type: memory
  type: project
  originSessionId: 3c210345-b844-43ed-87b1-32191735690c
  modified: 2026-10-26T12:42:49.862Z
---

After accepting B-118 (Core HR in French) on 2026-10-26 the user said: "we need to move on from internationalization as quick as we can, we probably won't demo much of it besides showing a few screens at most, so we don't need perfection, we just need the feature working in fr and ar."

**Why:** internationalization is a checkbox for the demo; product work elsewhere matters more.

**How to apply:** for B-119 and B-115, translate what renders, one target-language test per module, checks once at the end, a handful of screens, no wording polish. Arabic = `ar` catalogues for every namespace plus RTL (`dir` from `directionOf`), an Arabic face, and RTL fixes only where a demo screen visibly breaks. Server text (B-116) stays out unless asked. Details in `.local-docs/agents/plans/B-114-modules-in-french.md` ("Speed mode"). Related: [[minimize-eta-no-fluff]].
