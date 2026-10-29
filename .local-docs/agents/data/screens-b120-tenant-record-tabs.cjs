#!/usr/bin/env node
/**
 * B-120 + B-099 screens: the tenant record's tabs and archival, dark at 1440×900, through the shell.
 *
 * Signs in as the platform administrator, chooses the language in Settings › Preferences, then captures a live tenant
 * (Carthage · Planning: Overview, Access, Products, Activity, the record menu and the archive confirmation, which is
 * cancelled) and an archived preset tenant (Overview, Access). Ends with the account back in English.
 *
 * Usage: node .local-docs/agents/data/screens-b120-tenant-record-tabs.cjs [en|ar|fr ...]   (default: en ar)
 * Writes PNGs to .local-docs/agents/plans/B-120-screens/<lang>-<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const EMAIL = "admin@ey-hr.com";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-120-screens");
const LABEL = { en: "English", fr: "Français", ar: "العربية" };
const MENU = { en: "Tenant actions", fr: "Actions sur l’organisation", ar: "إجراءات المؤسسة" };
const ARCHIVE = { en: "Archive tenant", fr: "Archiver l’organisation", ar: "أرشفة المؤسسة" };

const presets = JSON.parse(fs.readFileSync(path.join(__dirname, "demo-presets.local.json"), "utf8"));
const LIVE = presets.presets.planning.tenantId;
const ARCHIVED = presets.retired.at(-1).tenantId;

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
}

async function shot(page, lang, name) {
  await page.screenshot({ path: path.join(OUT, `${lang}-${name}.png`) });
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

/** Chooses a language in Settings › Preferences and waits for the page to switch. */
async function chooseLanguage(page, lang) {
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  if (await page.evaluate((expected) => document.documentElement.lang === expected, lang)) return;
  const option = page.getByRole("radio", { name: LABEL[lang] }).or(page.getByRole("button", { name: LABEL[lang] }));
  await option.first().click();
  await page.waitForFunction((expected) => document.documentElement.lang === expected, lang, { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

async function open(page, route) {
  await page.goto(`${BASE}/platform/tenants/${route}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
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

  await open(page, LIVE);
  await shot(page, lang, "live-overview");
  await page.getByRole("button", { name: MENU[lang] }).click();
  await page.waitForTimeout(600);
  await shot(page, lang, "live-menu");
  await page.getByRole("menuitem", { name: ARCHIVE[lang] }).click();
  await page.waitForTimeout(800);
  await shot(page, lang, "live-archive-confirm");
  await page.keyboard.press("Escape");

  for (const tab of ["access", "products", "activity"]) {
    await open(page, `${LIVE}/${tab}`);
    await shot(page, lang, `live-${tab}`);
  }
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(600);
  await shot(page, lang, "live-activity-scrolled");

  await open(page, ARCHIVED);
  await shot(page, lang, "archived-overview");
  await page.getByRole("button", { name: MENU[lang] }).click();
  await page.waitForTimeout(600);
  await shot(page, lang, "archived-menu");
  await page.keyboard.press("Escape");
  await open(page, `${ARCHIVED}/access`);
  await shot(page, lang, "archived-access");

  await context.close();
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "ar"];
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of langs) await captureLanguage(browser, lang);
  } finally {
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
