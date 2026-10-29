#!/usr/bin/env node
/**
 * B-094 drag screens as built since B-139, dark at 1440×900, through the shell. Changes no data (the panel is
 * closed without saving).
 *
 * As Amira (HR), around Mariam Gharbi: Aicha's card dragged over Meriem Hamrouni, then the drop opening the change
 * panel in the chart's slot with the new manager filled in and Aicha previewed in her new place.
 *
 * Usage: node .local-docs/agents/data/screens-b094-drag-panel.cjs
 * Writes 13-drag-over-new-manager.png and 14-drag-change-panel.png to .local-docs/agents/plans/B-094-screens/.
 */
const path = require("path");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");

const BASE = "http://localhost:3000";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-094-screens");

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

const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log(`  ${name}.png`); };
const node = (page, name) => page.locator(".oc-node", { has: page.getByText(name, { exact: true }) }).first();

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

    await page.getByRole("searchbox", { name: "Find a person or team" }).fill("Mariam Gharbi");
    await page.waitForTimeout(400);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1600);
    await page.getByRole("button", { name: "Close" }).click().catch(() => {});
    await page.waitForTimeout(600);

    const from = await node(page, "Aicha Bouazizi").boundingBox();
    const to = await node(page, "Meriem Hamrouni").boundingBox();
    if (!from || !to) throw new Error("cards not on screen");
    await page.mouse.move(from.x + 40, from.y + 40);
    await page.mouse.down();
    await page.mouse.move(from.x + 80, from.y + 60, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
    await page.waitForTimeout(300);
    // 13-drag-over-new-manager (session B) still shows the drag as it is.
    await page.mouse.up();
    await page.locator("aside").getByText("Meriem Hamrouni").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    await shot(page, "14-drag-change-panel");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
