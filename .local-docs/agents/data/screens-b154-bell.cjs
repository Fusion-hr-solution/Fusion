#!/usr/bin/env node
/**
 * B-154 screens: the moment a notification arrives, dark at 1440×900, through the shell, on Carthage Digital Group
 * (after seed-b154-bell-week.mjs). As Mariam: the bell's panel on Home; then Amira praises her through the API and the
 * pop-up slides in live; Open lands on the praise card; Settings › Notifications with Pop-ups and Sound.
 *
 * Writes: one praise from Amira to Mariam; a re-run deletes the previous run's first (as Amira, HR).
 * Usage: node .local-docs/agents/data/screens-b154-bell.cjs
 * Writes PNGs to .local-docs/agents/plans/B-154-screens/<name>.png.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { PASSWORD } = require("../../../.agents/skills/fusion-dev/scripts/api.cjs");

const BASE = "http://localhost:3000";
const GATEWAY = "http://localhost:5000";
const MESSAGE = "The roadmap review was the clearest we have had. Thank you for the prep.";
const OUT = path.join(__dirname, "..", "plans", "B-154-screens");
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
  console.log(`  ${name}.png   (title: ${await page.title()})`);
}

async function api(token, method, route, body) {
  const r = await fetch(`${GATEWAY}${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${route} → ${r.status} ${JSON.stringify(json)?.slice(0, 300)}`);
  return json?.data ?? json;
}

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
    const page = await context.newPage();

    await signIn(page, "mariam.gharbi@example.test");
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await bell.waitFor({ state: "visible", timeout: 240_000 });
    await page.waitForTimeout(4000);
    await bell.click();
    await page.getByRole("heading", { name: "Today" }).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "01-bell-panel");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);

    // Amira praises Mariam: the live nudge brings it into the open tab.
    const amira = (await api(null, "POST", "/api/identity/auth/login", { email: "amira.khelifi@example.test", password: PASSWORD })).accessToken;
    const mariam = (await api(null, "POST", "/api/identity/auth/login", { email: "mariam.gharbi@example.test", password: PASSWORD })).employeeId;
    const values = await api(amira, "GET", "/api/performance/values");
    const mine = await api(amira, "GET", "/api/performance/praise?scope=byMe&limit=50");
    for (const old of (mine.items ?? mine).filter((p) => p.message === MESSAGE))
      await api(amira, "DELETE", `/api/performance/praise/${old.id}`);
    await api(amira, "POST", "/api/performance/praise", {
      id: crypto.randomUUID(),
      recipientEmployeeIds: [mariam],
      competencyId: values[0].id,
      message: MESSAGE,
    });
    const popup = page.getByRole("status").filter({ hasText: "Amira Khelifi" });
    await popup.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(700);
    await shot(page, "02-popup-arrives");

    await popup.getByRole("button", { name: "Open" }).click();
    await page.waitForURL(/\/performance\/feedback/, { timeout: 240_000 });
    await page.locator(".animate-land").first().waitFor({ state: "attached", timeout: 240_000 });
    await page.waitForTimeout(500);
    await shot(page, "03-landed-on-praise");

    await page.goto(`${BASE}/settings/notifications`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.getByRole("switch", { name: "Pop-ups" }).waitFor({ state: "visible", timeout: 240_000 });
    await page.waitForTimeout(1200);
    await shot(page, "04-settings-notifications");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
