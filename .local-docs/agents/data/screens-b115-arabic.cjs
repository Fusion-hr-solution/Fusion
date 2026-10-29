#!/usr/bin/env node
/**
 * B-115 screens: Arabic, right to left, dark at 1440×900, through the shell.
 *
 * Signs in as Amira (tenant administrator and manager), chooses العربية in Settings › Preferences, captures
 * a few screens across the frame, Core HR and Performance, then chooses English again so the account ends in English.
 *
 * Usage: node .local-docs/agents/data/screens-b115-arabic.cjs [ar|en ...]   (default: ar)
 * Writes PNGs to .local-docs/agents/plans/B-115-screens/<lang>-<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const EMAIL = "amira.khelifi@example.test";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-115-screens");

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

const SCREENS = [
  ["home", "/"],
  ["settings", "/settings"],
  ["core-overview", "/core"],
  ["core-people", "/core/people"],
  ["core-organization", "/core/organization"],
  ["overview", "/performance"],
  ["my-plan", "/performance/plan"],
  ["my-team", "/performance/team"],
  ["reviews", "/performance/reviews"],
];

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
  for (const [name, route] of SCREENS) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 300_000 });
    await settle(page);
    await shot(page, lang, name);
  }
  await context.close();
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["ar"];
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
