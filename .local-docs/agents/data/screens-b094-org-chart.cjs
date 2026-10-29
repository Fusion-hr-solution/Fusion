#!/usr/bin/env node
/**
 * B-094 session A screens: the people org chart, dark at 1440×900, through the shell. Changes no data.
 *
 * As Aicha: Around you (opens on Mariam's team), the whole company fitted, a search for Khaled with his line lit and
 * the panel open. As Mariam: Around you with Fares's sub-team unfolded.
 *
 * Usage: node .local-docs/agents/data/screens-b094-org-chart.cjs
 * Writes PNGs to .local-docs/agents/plans/B-094-screens/<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-094-screens");
fs.mkdirSync(OUT, { recursive: true });

async function signIn(page, email) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const submit = page.locator('button[type="submit"]');
  await submit.waitFor({ state: "visible", timeout: 120_000 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.waitForTimeout(500);
    if ((await page.inputValue("#email")) === email) break;
  }
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 120_000 });
}

async function darkPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("theme", "dark");
    } catch {}
  });
  return context.newPage();
}

async function openChart(page) {
  await page.goto(`${BASE}/core/org-chart`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.locator(".oc-node").first().waitFor({ state: "visible", timeout: 240_000 });
  await page.waitForTimeout(1500);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const aicha = await darkPage(browser);
    await signIn(aicha, "aicha.bouazizi@example.test");
    await openChart(aicha);
    await shot(aicha, "01-aicha-around-you");

    await aicha.getByRole("radio", { name: "Whole company" }).click();
    await aicha.waitForTimeout(1500);
    await shot(aicha, "02-aicha-whole-company");

    await aicha.getByRole("searchbox", { name: "Find a person or team" }).fill("Khaled");
    await aicha.waitForTimeout(400);
    await shot(aicha, "03-aicha-search");
    await aicha.keyboard.press("Enter");
    await aicha.waitForTimeout(1600);
    await shot(aicha, "04-aicha-found-with-panel");

    const mariam = await darkPage(browser);
    await signIn(mariam, "mariam.gharbi@example.test");
    await openChart(mariam);
    const fold = mariam.locator('[data-oc-id] .oc-fold[aria-expanded="false"]').first();
    if (await fold.count()) await fold.evaluate((button) => button.click());
    await mariam.waitForTimeout(1200);
    await shot(mariam, "05-mariam-around-you-unfolded");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
