#!/usr/bin/env node
/**
 * B-113 screens: Fusion's frame in French and in English, dark at 1440×900, through the shell.
 *
 * Signs in as Amira Khelifi (tenant administrator), chooses Français in Settings › Preferences (the product's own
 * flow, which saves the language on her account), captures every frame screen and settings section, then chooses
 * English again so her account ends as it started. Also captures sign-in and two invitation pages signed out, with
 * the language the browser last used (the NEXT_LOCALE cookie).
 *
 * Usage: node .local-docs/agents/data/screens-b113-frame-languages.cjs [fr|en ...]   (default: fr en)
 * Writes PNGs to .local-docs/agents/plans/B-113-screens/<lang>-<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const EMAIL = "amira.khelifi@example.test";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-113-screens");

const SIGNED_IN = [
  ["home", "/"],
  ["preferences", "/settings"],
  ["notifications", "/settings/notifications"],
  ["core-company", "/core/settings/company"],
  ["core-employee-fields", "/core/settings/employee-fields"],
  ["core-roles", "/core/settings/roles"],
  ["core-invitations", "/core/settings/invitations"],
  ["core-change-history", "/core/settings/change-history"],
  ["performance-rating-scale", "/performance/settings/rating-scale"],
  ["performance-competencies", "/performance/settings/competencies"],
  ["performance-review-questions", "/performance/settings/review-questions"],
  ["performance-reviews", "/performance/settings/reviews"],
  ["performance-planning", "/performance/settings/planning"],
  ["performance-conversations", "/performance/settings/conversations"],
  ["performance-ai-and-data", "/performance/settings/ai-and-data"],
  // The boundary: a module work screen stays English until phase 3, inside a French frame.
  ["boundary-core-people", "/core/people"],
];

const SIGNED_OUT = [
  ["sign-in", "/auth/signin"],
  ["invitation-link-broken", "/activate-invitation?credential=not-a-real-credential"],
  ["workforce-invitation-missing", "/core/invite/accept"],
];

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
  // Skeletons give way to values; give late queries a moment.
  await page.waitForTimeout(2500);
}

async function capture(page, lang, name, route) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  const file = path.join(OUT, `${lang}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${lang}-${name}.png  ${page.url().replace(BASE, "")}`);
}

async function signIn(page) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const submit = page.locator('button[type="submit"]');
  await submit.waitFor({ state: "visible", timeout: 120_000 });
  // Hydration can reset a field filled too early: fill until the value sticks.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.waitForTimeout(500);
    if ((await page.inputValue("#email")) === EMAIL) break;
  }
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 120_000 });
}

/** Chooses a language in Settings › Preferences and waits for "Saved". */
async function chooseLanguage(page, lang) {
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  const label = lang === "fr" ? "Français" : "English";
  const option = page.getByRole("radio", { name: label }).or(page.getByRole("button", { name: label }));
  if ((await option.first().getAttribute("aria-checked")) === "true" || (await option.first().getAttribute("data-state")) === "on") {
    return;
  }
  await option.first().click();
  await page.getByRole("status").filter({ hasText: lang === "fr" ? "Enregistré" : "Saved" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "en"];
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of langs) {
      console.log(`== ${lang}`);
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
      await context.addInitScript(() => {
        try {
          window.localStorage.setItem("theme", "dark");
        } catch {}
      });
      const page = await context.newPage();
      await signIn(page);
      await chooseLanguage(page, lang);
      for (const [name, route] of SIGNED_IN) await capture(page, lang, name, route);

      // Sign out through the person menu; the language cookie stays for the sign-in page.
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await page.getByRole("button", { name: /Amira Khelifi/ }).first().click();
      await page.getByRole("menuitem", { name: lang === "fr" ? "Se déconnecter" : "Sign out" }).click();
      await page.waitForURL(/\/auth\/signin/, { timeout: 60_000 });
      for (const [name, route] of SIGNED_OUT) await capture(page, lang, name, route);
      await context.close();
    }
  } finally {
    // Leave Amira's account in English, as the board's accounts expect.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await signIn(page);
    await chooseLanguage(page, "en");
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
