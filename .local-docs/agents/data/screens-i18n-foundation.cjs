// add-i18n-foundation (B-105 phase 1) screens, dark 1440×900 through the shell, into plans/B-105-screens/.
//   node .local-docs/agents/data/screens-i18n-foundation.cjs
// en-*: the main screens after the start/end conversion, to compare with how they looked before.
// rtl-*: Home and a Performance plan forced to right to left as Arabic will set it (dir="rtl", lang="ar"; a
//        capture-only toggle, not product code), to show the layout mirrors.
// fr-*: Amira chooses Français in Settings › Preferences (through the page, which saves it to her account), then
//       Core HR's settings mode; she switches back to English at the end, so her account then says "en".
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const OUT = path.join(__dirname, "../plans/B-105-screens");
fs.mkdirSync(OUT, { recursive: true });
const AICHA = "aicha.bouazizi@example.test";
const AMIRA = "amira.khelifi@example.test";
const ADMIN = "admin@ey-hr.com";
const log = [];

async function signIn(browser, email, landing) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await context.addInitScript(() => {
    try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") log.at(-1)?.console.push(m.text().slice(0, 300)); });
  await page.goto(`${BASE}${landing}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  for (let attempt = 0; attempt < 4 && new URL(page.url()).pathname.includes("signin"); attempt++) {
    const emailBox = page.locator('input[type="email"], input[name="email"]').first();
    await emailBox.waitFor({ timeout: 240000 });
    await page.waitForTimeout(800);
    await emailBox.fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    if ((await emailBox.inputValue()) !== email) continue;
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("signin"), { timeout: 60000 }).catch(() => {});
  }
  if (new URL(page.url()).pathname.includes("signin")) throw new Error(`Could not sign in as ${email}`);
  return page;
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-slot="skeleton"], [aria-busy="true"]'), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function shot(page, name, route, { rtl = false } = {}) {
  const entry = { name, route, console: [] };
  log.push(entry);
  if (route) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  }
  await settle(page);
  if (rtl) {
    // As Arabic will: direction and language. The CSS build turns logical insets into left/right keyed on
    // :lang(ar …), so `dir` alone would leave inset-s/inset-e unflipped.
    await page.evaluate(() => { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; });
    await page.waitForTimeout(800);
  }
  entry.dir = await page.evaluate(() => document.documentElement.dir);
  entry.lang = await page.evaluate(() => document.documentElement.lang);
  entry.h1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? null);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`${name}  ${entry.url = page.url().replace(BASE, "")}  h1=${entry.h1}  dir=${entry.dir}`);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const aicha = await signIn(browser, AICHA, "/");
    await shot(aicha, "en-home", "/");
    await shot(aicha, "en-performance-plan", "/performance/plan");
    await shot(aicha, "rtl-home", "/", { rtl: true });
    await shot(aicha, "rtl-performance-plan", "/performance/plan", { rtl: true });

    const amira = await signIn(browser, AMIRA, "/core/people");
    await shot(amira, "en-core-people", "/core/people");
    await shot(amira, "en-settings-company", "/core/settings/company");

    // Français, through Preferences: saved to the account, then the page re-renders in French.
    await shot(amira, "en-preferences", "/settings");
    await amira.getByRole("radio", { name: "Français" }).click();
    await amira.getByRole("heading", { level: 1, name: "Préférences" }).waitFor({ timeout: 60000 });
    await shot(amira, "fr-preferences", null);
    await shot(amira, "fr-core-settings-company", "/core/settings/company");
    await shot(amira, "fr-performance-plan-untranslated", "/performance/plan");
    await amira.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await settle(amira);
    await amira.getByRole("radio", { name: "English" }).click();
    await amira.getByRole("heading", { level: 1, name: "Preferences" }).waitFor({ timeout: 60000 });
    await shot(amira, "en-preferences-back", null);

    const admin = await signIn(browser, ADMIN, "/platform");
    await shot(admin, "en-platform-tenants", "/platform");
  } finally {
    fs.writeFileSync(path.join(OUT, "log.json"), JSON.stringify(log, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
