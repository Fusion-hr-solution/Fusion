#!/usr/bin/env node
/**
 * B-109 screens: Settings › Change history with role changes as sentences, dark at 1440×900, through the shell.
 *
 * Signs in as Amira, chooses the language in Settings › Preferences, opens Change history filtered to Roles with the
 * two newest entries expanded, then chooses English again so the account ends in English. Run
 * journey-b109-role-changes.cjs first so the newest entries are a role assignment and a role edit.
 *
 * Usage: node .local-docs/agents/data/screens-b109-change-history.cjs [en|fr|ar ...]   (default: en fr ar)
 * Writes PNGs to .local-docs/agents/plans/B-109-screens/<lang>-<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const EMAIL = "amira.khelifi@example.test";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-109-screens");

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
}

async function shot(page, lang, name) {
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
  const label = { fr: "Français", ar: "العربية" }[lang] ?? "English";
  const option = page.getByRole("radio", { name: label }).or(page.getByRole("button", { name: label }));
  if (
    (await option.first().getAttribute("aria-checked")) === "true" ||
    (await option.first().getAttribute("data-state")) === "on"
  ) {
    return;
  }
  await option.first().click();
  // The confirmation can come and go quickly; the page re-rendering in the chosen language is the real signal.
  await page
    .getByRole("status")
    .filter({ hasText: { fr: "Enregistré", ar: "تم الحفظ" }[lang] ?? "Saved" })
    .waitFor({ timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForFunction((expected) => document.documentElement.lang === expected, lang, { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

async function captureLanguage(browser, lang) {
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
  await page.goto(`${BASE}/core/settings/change-history`, { waitUntil: "domcontentloaded", timeout: 300_000 });
  await settle(page);
  await shot(page, lang, "change-history");
  const section = page.locator("select").first();
  await section.selectOption("roles");
  await page.waitForTimeout(800);
  const entries = page.locator("li button[aria-expanded]");
  for (let index = 0; index < Math.min(2, await entries.count()); index += 1) await entries.nth(index).click();
  await page.waitForTimeout(800);
  await shot(page, lang, "roles-expanded");
  await context.close();
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "fr", "ar"];
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of langs) await captureLanguage(browser, lang);
  } finally {
    // Leave Amira's account in English.
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
