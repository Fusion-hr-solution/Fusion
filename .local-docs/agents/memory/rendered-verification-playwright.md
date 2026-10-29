---
name: rendered-verification-playwright
description: "How to do rendered/visual verification of Fusion frontend through the shell — the repo's own Playwright, not an MCP."
metadata: 
  node_type: memory
  type: reference
  originSessionId: e088331e-dabe-40eb-a7d4-c8d84c9d98cf
  modified: 2026-07-22T19:58:04.280Z
---

**On request only (2026-10-06):** rendered QA runs only when the user asks; the old `.local-docs/qa` harness was deleted. Use the playwright-cli skill or this recipe.

**Update 2026-10-02:** `apps/shell` no longer has `playwright.config.ts`/e2e specs; drive `require("C:/Code/EY/Fusion/Frontend/node_modules/playwright")` chromium from a scratchpad Node script (sign-in button: `getByRole("button",{name:"Sign in",exact:true})` — "Sign in with SSO" also matches). Older notes below.

Rendered visual verification of Fusion frontend uses the **repo's own Playwright** (there is no Playwright MCP registered in Claude Code this session), configured in `Frontend/apps/shell/playwright.config.ts` (`@playwright/test`, chromium project, baseURL `http://localhost:3000`).

Recipe:
1. `cd Frontend/apps/shell; pnpm exec playwright install chromium` (one-time).
2. Write a spec in `apps/shell/e2e/*.spec.ts`; screenshot targets go under `.local-docs/screenshots/<change>/`. Pattern to copy: `e2e/checkins-follow-up.spec.ts` and `e2e/performance-configuration-overhaul.spec.ts`.
3. **Sign-in must be hydration-tolerant** — the fixture `loginThroughShell` fills the email immediately and it gets reset by a client re-render (silent fail; its URL regex also matches `?callbackUrl=/performance`). Use a tolerant `ensureSignedIn`: goto `/performance`, wait for the "Sign In" button `toBeEnabled`, fill Email+Password, re-assert the email `toHaveValue`, click, expect `/performance`.
4. Credentials via env: `FUSION_E2E_EMAIL` / `FUSION_E2E_PASSWORD` (see `e2e/fixtures.ts` `e2eEnv`). Atlas tenant HR = `the Atlas HR account` / `Admin@123456` (see atlas-demo-seed (archived)). Confirm creds against `POST /api/identity/auth/login` (200 = valid).
5. **Dark mode** = the top-bar theme control is a **dropdown**, not a toggle: `getByRole("button", { name: "Change theme" }).click()` then `getByRole("menuitem", { name: "Dark" }).click()`; theme persists across navigation.
6. Run: `FUSION_E2E_EMAIL=... FUSION_E2E_PASSWORD=... pnpm exec playwright test <spec> --project=chromium`. Full stack (shell :3000, perf :3004, gateway :5000, identity :5101, perf :5401) must be up. On failure, read `e2e/.artifacts/**/test-failed-1.png`.

Note: inline `fetch()` in Bash `node -e` is intercepted by the context-mode hook; prefer Playwright's `request` context or the app itself for HTTP checks.
