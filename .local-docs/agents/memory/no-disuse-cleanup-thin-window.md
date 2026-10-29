---
name: no-disuse-cleanup-thin-window
description: "Don't recommend disabling skills/MCP/plugins based on low usage over a short scan window"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0d0faf61-dd8d-4e60-8d2e-e8a01e25d975
---

During `/doctor` (2026-07-18) the user rejected disabling "unused" OpenSpec skills and the shadcn_studio MCP, saying a ~24-day / 50-session window is far too short to judge disuse — occasional workflow skills (archive, propose, verify) may fire only once per change and still be essential.

**Why:** Absence of invocations over a thin window is not evidence of disuse for low-frequency workflow tooling; the user curates their extension set deliberately (see mcp-standard-set (archived)).

**How to apply:** Don't propose disabling/removing extensions on usage-frequency grounds unless usage data spans a genuinely long period AND the item is clearly redundant. Prefer keep. Surface the usage figure as FYI, not as a disable verdict. Version updates and broken-config fixes are still fine to recommend.
