#!/usr/bin/env node
/**
 * B-131 screens: the org chart's Review progress lens, dark at 1440×900, through the shell, on the Year-end preset
 * (an active round). Changes no data.
 *
 * As Amira (HR): the whole company in the lens, then only the late ones. As Mariam (manager): her chart in the lens,
 * coloured only where Performance lets her read the review. As Aicha: only her own card.
 *
 * Usage: node .local-docs/agents/data/screens-b131-review-lens.cjs
 * Writes PNGs to .local-docs/agents/plans/B-131-screens/<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-131-screens");
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

async function find(page, name) {
  await page.getByRole("searchbox", { name: "Find a person or team" }).fill(name);
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1600);
}

async function openChart(page, query = "") {
  await page.goto(`${BASE}/core/org-chart${query}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.locator(".oc-node").first().waitFor({ state: "visible", timeout: 240_000 });
  await page.waitForTimeout(1500);
}

const presets = require("./demo-presets.local.json");
const domain = (presets.presets ?? presets).yearend.domain;

async function reviewLens(page) {
  await page.getByRole("combobox", { name: "Colour by" }).click();
  await page.getByRole("option", { name: "Review progress" }).click();
  await page.locator('[aria-label^="Show only"]').first().waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const newPage = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
      await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
      return context.newPage();
    };

    const amira = await newPage();
    await signIn(amira, `amira.khelifi@${domain}`);
    await openChart(amira, "?view=company");
    await reviewLens(amira);
    await amira.getByRole("button", { name: "Fit to screen" }).click();
    await amira.waitForTimeout(900);
    await shot(amira, "01-hr-company");
    await amira.getByRole("button", { name: "Show only Late" }).click();
    await amira.waitForTimeout(900);
    await shot(amira, "02-hr-late-only");
    await amira.context().close();

    const mariam = await newPage();
    await signIn(mariam, `mariam.gharbi@${domain}`);
    await openChart(mariam);
    await reviewLens(mariam);
    await shot(mariam, "03-manager-around-you");
    await mariam.context().close();

    const aicha = await newPage();
    await signIn(aicha, `aicha.bouazizi@${domain}`);
    await openChart(aicha);
    await reviewLens(aicha);
    await shot(aicha, "04-employee-own");
    await aicha.context().close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
