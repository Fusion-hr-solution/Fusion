#!/usr/bin/env node
/**
 * B-132 screens: the org chart above 3,000 people (the tenant from seed-b132-large-tenant.mjs), dark at 1440×900,
 * through the shell, as Amira (HR). Changes no data.
 *
 * The whole company's first window (folded leaders), a team opened from it, a search reaching someone not loaded,
 * the chart after going there, and Around you.
 *
 * Usage: node .local-docs/agents/data/screens-b132-org-chart-windows.cjs
 * Writes PNGs to .local-docs/agents/plans/B-132-screens/<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-132-screens");
fs.mkdirSync(OUT, { recursive: true });
const tenant = require("./large-tenant.local.json");

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

async function openChart(page, query = "") {
  await page.goto(`${BASE}/core/org-chart${query}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.locator(".oc-node").first().waitFor({ state: "visible", timeout: 240_000 });
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
    const page = await context.newPage();
    await signIn(page, tenant.amira);

    await openChart(page, "?view=company");
    console.log(`  ${await page.locator(".oc-node").count()} cards on the first window`);
    await shot(page, "01-company-first-window");

    // Around you, full size: opening folded leaders loads their teams.
    await openChart(page);
    await shot(page, "02-around-you");
    for (const name of ["03-team-opened"]) {
      const before = await page.locator(".oc-node").count();
      await page.locator('button.oc-fold[aria-expanded="false"]').first().click();
      await page.waitForFunction((n) => document.querySelectorAll(".oc-node").length > n, before, { timeout: 60_000 });
      await page.waitForTimeout(1500);
      console.log(`  ${await page.locator(".oc-node").count()} cards`);
      await shot(page, name);
    }

    // Search reaches people outside what's loaded.
    await page.getByRole("searchbox", { name: "Find a person or team" }).fill("Aicha");
    await page.locator('[role="option"]').first().waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(600);
    await shot(page, "04-search-whole-company");
    const target = (await page.locator('[role="option"]').last().innerText()).split("\n")[0];
    await page.locator('[role="option"]').last().click();
    await page.locator(`[data-oc-id][aria-pressed="true"]`).waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1500);
    console.log(`  went to ${target}`);
    await shot(page, "05-went-to-search-hit");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
