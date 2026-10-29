#!/usr/bin/env node
/**
 * B-108 screens: Performance Settings show where things are used (Year-end preset, dark 1440x900, as Amira). Changes no data.
 * Usage: node .local-docs/agents/data/screens-b108-settings-usage.cjs
 * Writes PNGs to .local-docs/agents/plans/B-108-screens/<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-108-screens");
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

const presets = require("./demo-presets.local.json");
const domain = (presets.presets ?? presets).yearend.domain;

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
    const page = await context.newPage();
    await signIn(page, `amira.khelifi@${domain}`);
    for (const [name, section, text] of [
      ["01-rating-scale-versions", "rating-scale", "Used by"],
      ["02-competencies-used-in", "competencies", "Used in"],
      ["03-questions-round-counts", "review-questions", "Asked in"],
    ]) {
      await page.goto(`${BASE}/performance/settings/${section}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
      await page.getByText(text).first().waitFor({ state: "visible", timeout: 240_000 });
      if (section === "rating-scale") await page.getByText(text).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      await shot(page, name);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
