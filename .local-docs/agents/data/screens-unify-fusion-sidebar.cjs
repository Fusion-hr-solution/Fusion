// B-078 live screenshots of the shared Fusion sidebar, dark, 1440×900 (the user's laptop demo size; no other widths),
// through the shell, into plans/B-070-slice-6-screens/live/. Opens a few records first so Recent has something to show.
// Changes no data (records are only viewed; the switcher and person menus are opened, never followed).
//   node .local-docs/agents/data/screens-unify-fusion-sidebar.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE, employee, plan } = require("./carthage-ids.cjs");

const OUT = path.join(__dirname, "../plans/B-070-slice-6-screens/live");

async function signIn(browser, email, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "dark" });
  await context.addInitScript(() => {
    try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ }
    // The Next.js dev badge sits over the sidebar's person panel; it doesn't exist in a build.
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240000 });
  for (let attempt = 0; attempt < 4 && new URL(page.url()).pathname.includes("signin"); attempt++) {
    const emailBox = page.locator('input[type="email"], input[name="email"]').first();
    await emailBox.waitFor({ timeout: 240000 });
    await page.waitForTimeout(800);
    await emailBox.fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    if ((await emailBox.inputValue()) !== email) continue;
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("signin"), { timeout: 30000 }).catch(() => {});
  }
  if (new URL(page.url()).pathname.includes("signin")) throw new Error(`Could not sign in as ${email}`);
  return page;
}

async function open(page, url, ready) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.getByRole("complementary", { name: "Fusion navigation" }).first().waitFor({ timeout: 240000 });
  if (ready) await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => {});
}

async function save(page, name, settle = 2500) {
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`saved ${name}.png`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const amiraToken = await login("amira.khelifi@example.test");
  const get = async (url) => (await call("GET", url, null, amiraToken)).json.data;
  const round = (await get(`/api/performance/cycles/${CYCLE}/review-rounds`)).find((r) => r.name === "Year-end review");
  const people = (await get(`/api/corehr/employees/people?page=1&pageSize=5&q=Omar`)) ?? {};
  const omarKey = (people.items ?? people.people ?? [])[0]?.employeeKey;
  // A non-root unit to open in Core HR, found by walking the published hierarchy.
  const units = [];
  const walk = (node, depth) => {
    if (!node || typeof node !== "object") return;
    const unit = node.unit ?? node;
    if (unit.id && unit.name) units.push({ id: unit.id, name: unit.name, depth });
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach((child) => walk(child, depth + 1));
  };
  const today = new Date().toISOString().slice(0, 10);
  (await get(`/api/corehr/organization/hierarchy?asOf=${today}`)).roots.forEach((root) => walk(root, 0));
  const unit = units.find((u) => u.depth > 0 && /^Engineering B$/.test(u.name)) ?? units.find((u) => u.depth > 1);

  const browser = await chromium.launch();
  try {
    // Home: no current module, so the modules are listed with their counts.
    const amira = await signIn(browser, "amira.khelifi@example.test", 1440);
    await open(amira, "/", "Good");
    await save(amira, "b078-01-home-amira");

    // Amira opens a round, a person and calibration, then sits on Cycle with the switcher open (boards 01, 02).
    await open(amira, `/performance/reviews/rounds/${round.id}`, round.name);
    await amira.waitForTimeout(1500);
    // Omar Mansour (CDG-006) reports to Amira: his approved plan and his person page.
    await open(amira, `/performance/cycles/${CYCLE}/plans/${plan("CDG-006")}`, "Omar");
    await amira.waitForTimeout(1500);
    await open(amira, `/performance/people/${employee("CDG-006")}`);
    await amira.getByRole("heading", { name: "Omar Mansour" }).first().waitFor({ timeout: 180000 }).catch(() => {});
    await amira.waitForTimeout(1500);
    await open(amira, `/performance/reviews/rounds/${round.id}/calibration`, "Calibrat");
    await amira.waitForTimeout(1500);
    await open(amira, "/performance/cycle", "FY2027");
    await save(amira, "b078-02-performance-hr-cycle");
    await amira.getByRole("button", { name: /^Performance/ }).first().click();
    await amira.getByText("Switch module").waitFor({ timeout: 10000 });
    await save(amira, "b078-03-switcher-open", 800);
    await amira.keyboard.press("Escape");

    // Core HR: its own sections, Workforce access counted, Recent people and units (board 03).
    if (omarKey) {
      await open(amira, `/core/people/${omarKey}`, "Omar");
      await amira.waitForTimeout(1500);
    }
    if (unit) {
      await open(amira, `/core/organization?unit=${unit.id}`);
      await amira.getByRole("heading", { name: unit.name }).first().waitFor({ timeout: 180000 }).catch(() => {});
      await amira.waitForTimeout(2000);
    }
    await open(amira, "/core/people", "People");
    await save(amira, "b078-04-core-hr-amira");

    // Employee and manager in Performance (board 01).
    const aicha = await signIn(browser, "aicha.bouazizi@example.test", 1440);
    await open(aicha, "/performance", "Overview");
    await save(aicha, "b078-06-performance-employee-aicha");

    const mariam = await signIn(browser, "mariam.gharbi@example.test", 1440);
    await open(mariam, "/performance/team", "Team");
    await save(mariam, "b078-08-performance-manager-mariam");

    // Account type in plain words when there is no employee record.
    const admin = await signIn(browser, "sidebar.admin@example.test", 1440);
    await open(admin, "/", null);
    await save(admin, "b078-09-home-admin-without-employee");

  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
