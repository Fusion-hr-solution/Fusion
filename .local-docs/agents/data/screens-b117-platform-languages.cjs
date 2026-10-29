#!/usr/bin/env node
/**
 * B-117 screens: Platform in French and in English, dark at 1440×900, through the shell.
 *
 * Signs in as the platform administrator, chooses Français in Settings › Preferences (the product's own flow, which
 * saves the language on the account), captures the tenants list, provisioning (first and last step) and one tenant
 * record, then chooses English again so the account ends in English.
 *
 * Usage: node .local-docs/agents/data/screens-b117-platform-languages.cjs [fr|en ...]   (default: fr en)
 * Writes PNGs to .local-docs/agents/plans/B-117-screens/<lang>-<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const EMAIL = "admin@ey-hr.com";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-117-screens");

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
  const label = lang === "fr" ? "Français" : "English";
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
    .filter({ hasText: lang === "fr" ? "Enregistré" : "Saved" })
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

  await page.goto(`${BASE}/platform/tenants`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  await shot(page, lang, "tenants");

  // A row's menu, opened, shows the recoveries in the person's language.
  await page.getByRole("button", { name: lang === "fr" ? /^Actions pour / : /^Actions for / }).first().click();
  await page.waitForTimeout(600);
  await shot(page, lang, "tenants-row-menu");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/platform/tenants/new`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  // Leave the name empty and move on, so the step shows a validation message.
  await page.locator("#tenant-name").focus();
  await page.locator("#tenant-slug").focus();
  await page.waitForTimeout(400);
  await shot(page, lang, "provisioning-organization");

  // The stepper's steps are reached by their titles; they aren't exposed as buttons.
  const step = (label) => page.getByText(label, { exact: true }).first().click();

  await step(lang === "fr" ? "Région et produits" : "Region & products");
  await settle(page);
  await shot(page, lang, "provisioning-region");

  await step(lang === "fr" ? "Administrateur initial" : "Initial admin");
  await settle(page);
  await shot(page, lang, "provisioning-admin");

  await step(lang === "fr" ? "Vérification" : "Review");
  await settle(page);
  await shot(page, lang, "provisioning-review");

  // Leaving with nothing typed goes straight back; the record of the first tenant in the list.
  await page.goto(`${BASE}/platform/tenants`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  await page.locator("table tbody tr").first().click();
  await page.waitForURL(/\/platform\/tenants\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await settle(page);
  await shot(page, lang, "tenant-record");

  await page.getByRole("button", { name: lang === "fr" ? "Actions sur l’organisation" : "Tenant actions" }).click();
  await page.waitForTimeout(600);
  await shot(page, lang, "tenant-record-menu");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/platform/tenants/00000000-0000-4000-8000-000000000000`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await settle(page);
  await shot(page, lang, "tenant-not-found");

  await context.close();
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "en"];
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of langs) await captureLanguage(browser, lang);
  } finally {
    // Leave the platform administrator's account in English.
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
