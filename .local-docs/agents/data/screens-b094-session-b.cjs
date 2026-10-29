#!/usr/bin/env node
/**
 * B-094 session B screens: HR's org chart, dark at 1440×900, through the shell. Changes no data (the drag stops at
 * the prefilled Change manager task without saving).
 *
 * As Amira (HR): Around Tarek with Skander's dashed card, Rafik's last day in the panel, the chart on 1 Dec (Hela
 * under Amira), Tenure and Span lenses, Sofiene's dotted line to Karim, a drag onto a new manager with its confirm,
 * the prefilled Change manager task with dotted-line managers, and Replay mid-way.
 *
 * Usage: node .local-docs/agents/data/screens-b094-session-b.cjs
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

const node = (page, name) => page.locator(".oc-node", { has: page.getByText(name, { exact: true }) }).first();

async function find(page, name) {
  await page.getByRole("searchbox", { name: "Find a person or team" }).fill(name);
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1600);
}

async function lens(page, label) {
  await page.getByRole("combobox", { name: "Colour by" }).click();
  await page.getByRole("option", { name: label }).click();
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
    const page = await context.newPage();
    await signIn(page, "amira.khelifi@example.test");
    await page.goto(`${BASE}/core/org-chart`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.locator(".oc-node").first().waitFor({ state: "visible", timeout: 240_000 });
    await page.waitForTimeout(1500);

    // Around Tarek: Skander joins on 17 Nov as a dashed card.
    await find(page, "Tarek Ayari");
    await page.mouse.click(1000, 860);
    await page.waitForTimeout(600);
    await shot(page, "06-hr-upcoming-joiner");

    // Rafik's last day, in the panel.
    await find(page, "Rafik Sahbi");
    await shot(page, "07-hr-leaver-panel");

    // Whole company, then the chart on 1 Dec.
    await page.getByRole("radio", { name: "Whole company" }).click();
    await page.waitForTimeout(1500);
    await shot(page, "08-hr-whole-company-today");
    await page.getByRole("slider", { name: "Org chart as of" }).evaluate((input) => {
      const day = Math.round(Date.parse("2026-12-01") / 86_400_000);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, String(day));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(2500);
    await find(page, "Hela Ben Amor");
    await shot(page, "09-hr-1-december");
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.waitForTimeout(2000);

    // Lenses.
    await page.getByRole("button", { name: "Close" }).click().catch(() => {});
    await page.getByRole("button", { name: "Fit to screen" }).click();
    await page.waitForTimeout(900);
    await lens(page, "Tenure");
    await shot(page, "10-hr-tenure-lens");
    await lens(page, "Span of control");
    await shot(page, "11-hr-span-lens");
    await lens(page, "Division");

    // Sofiene's dotted line to Karim.
    await find(page, "Sofiene Jebali");
    await page.getByRole("button", { name: "Zoom out" }).evaluate((button) => button.click());
    await page.getByRole("button", { name: "Zoom out" }).evaluate((button) => button.click());
    await page.waitForTimeout(900);
    await shot(page, "12-dotted-line");

    // Drag Aicha onto Meriem Hamrouni: the confirm.
    await page.getByRole("button", { name: "Close" }).click().catch(() => {});
    await page.getByRole("radio", { name: /Around/ }).click();
    await find(page, "Mariam Gharbi");
    await page.getByRole("button", { name: "Close" }).click().catch(() => {});
    await page.waitForTimeout(600);
    const from = await node(page, "Aicha Bouazizi").boundingBox();
    const to = await node(page, "Meriem Hamrouni").boundingBox();
    if (from && to) {
      await page.mouse.move(from.x + 40, from.y + 40);
      await page.mouse.down();
      await page.mouse.move(from.x + 80, from.y + 60, { steps: 5 });
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
      await page.waitForTimeout(300);
      await shot(page, "13-drag-over-new-manager");
      await page.mouse.up();
      await page.waitForTimeout(600);
      await shot(page, "14-drag-confirm");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL(/change-manager/, { timeout: 120_000 });
      await page.getByText("Dotted-line managers").waitFor({ timeout: 120_000 });
      await page.waitForTimeout(2500);
      await shot(page, "15-change-manager-prefilled");
    } else console.log("  drag skipped: cards not on screen");

    // Replay, mid-way.
    await page.goto(`${BASE}/core/org-chart?view=company`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.locator(".oc-node").first().waitFor({ state: "visible", timeout: 240_000 });
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Replay" }).click();
    await page.waitForTimeout(9000);
    await shot(page, "16-replay");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
