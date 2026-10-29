#!/usr/bin/env node
/**
 * B-128 screens: open roles on the org chart, dark at 1440×900, through the shell. Changes no data (the add and
 * edit panels are cancelled). Needs the two roles from `journey-b128-open-roles.cjs`.
 *
 * As Aicha: Fares Lachheb's team with the dashed Hiring card and "1 open", and the role's panel.
 * As Amira (HR): Add open role under Walid Dridi with the live dashed preview, Edit on Fares's role, and the
 * whole company with its open roles count.
 *
 * Usage: node .local-docs/agents/data/screens-b128-open-roles.cjs
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

const role = (page, title) => page.locator(".oc-node.oc-role", { hasText: title }).first();

(async () => {
  const browser = await chromium.launch();
  try {
    const newPage = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
      await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
      return context.newPage();
    };

    // Aicha: Fares is hiring.
    const aicha = await newPage();
    await signIn(aicha, "aicha.bouazizi@example.test");
    await openChart(aicha);
    await find(aicha, "Fares Lachheb");
    await aicha.getByRole("button", { name: "Close" }).click().catch(() => {});
    await aicha.getByRole("button", { name: "Fit to screen" }).click();
    await aicha.waitForTimeout(900);
    await shot(aicha, "17-employee-hiring-card");
    await role(aicha, "Senior Product Designer").evaluate((el) => el.click());
    await aicha.waitForTimeout(800);
    await shot(aicha, "18-role-panel");
    await aicha.context().close();

    // Amira: add one under Walid, with the preview.
    const amira = await newPage();
    await signIn(amira, "amira.khelifi@example.test");
    await openChart(amira);
    await find(amira, "Walid Dridi");
    await amira.getByRole("button", { name: "Add open role" }).click();
    await amira.waitForTimeout(800);
    await amira.getByRole("textbox", { name: "Job title" }).fill("QA Lead");
    await amira.locator("aside").getByRole("button", { name: /Engineering A Core/ }).waitFor({ timeout: 60_000 }).catch(() => {});
    await amira.getByRole("button", { name: "Fit to screen" }).evaluate((el) => el.click());
    await amira.waitForTimeout(1200);
    await shot(amira, "19-add-open-role");
    await amira.getByRole("button", { name: "Cancel" }).click();
    await amira.waitForTimeout(800);

    // Edit Fares's role.
    await find(amira, "Fares Lachheb");
    await amira.getByRole("button", { name: "Close" }).click().catch(() => {});
    await role(amira, "Senior Product Designer").evaluate((el) => el.click());
    await amira.waitForTimeout(700);
    await amira.getByRole("button", { name: "Edit open role" }).click();
    await amira.waitForTimeout(1200);
    await shot(amira, "20-edit-open-role");
    await amira.getByRole("button", { name: "Cancel" }).click();
    await amira.waitForTimeout(600);

    // The whole company, with its open roles in the header.
    await openChart(amira, "?view=company");
    await shot(amira, "21-whole-company-open-roles");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
