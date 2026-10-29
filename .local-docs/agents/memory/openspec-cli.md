---
name: openspec-cli
description: OpenSpec CLI 1.14.2 is installed globally with pnpm; Git Bash needs the pnpm dir on PATH. `openspec/` is gitignored. Main specs are strict-valid since 2026-10-19 (B-079).
metadata:
  type: reference
---

- Installed 2026-10-15 with `pnpm add -g @fission-ai/openspec` (1.14.2), at `C:\Users\wsmtr\AppData\Local\pnpm`.
- PowerShell finds it on PATH. In Git Bash, first run `export PATH="$PATH:/c/Users/wsmtr/AppData/Local/pnpm"`.
- `openspec/` is gitignored, so specs and changes stay local and are never part of commits.
- Since 2026-10-19 (B-079) `openspec validate --specs --strict` passes 85/85, so it gates archives: keep new requirement bodies under 500 characters (split per behavior, each with a scenario), write a real Purpose for new capabilities, and keep a SHALL/MUST in every requirement body.

Related: [[slice-close-settles-everything]].
