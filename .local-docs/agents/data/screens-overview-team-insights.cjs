// B-070 slice 6 + B-077 live screenshots (dark, 1440×900), through the shell, into plans/B-070-slice-6-screens/live/s6-*.png.
// Carthage is in the Review phase, so these are the boards its data reaches: the three homes and one for an account
// without an employee record, the review-phase Overviews, My Team during the round and with Omar's released result, Insights with
// a drill-through, and the no-reports state. Changes no data.
//   node .local-docs/agents/data/screens-overview-team-insights.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

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
  const browser = await chromium.launch();
  try {
    const shots = [
      ["aicha.bouazizi@example.test", [
        ["/", "s6-04-home-employee", "Your year"],
        ["/performance", "s6-10-overview-employee-review", "Overview"],
        ["/performance/team", "s6-29-team-no-reports", "No one reports to you"],
      ]],
      ["mariam.gharbi@example.test", [
        ["/", "s6-05-home-manager", "Your year"],
        ["/performance", "s6-14-overview-manager-review", "Overview"],
        ["/performance/team", "s6-24-team-review", "Self-assessment"],
      ]],
      ["omar.mansour@example.test", [
        ["/performance/team", "s6-25-team-released-result", "Your team's results"],
      ]],
      ["amira.khelifi@example.test", [
        ["/", "s6-06-home-hr", "Your year"],
        ["/performance", "s6-20-overview-hr-review", "Overview"],
        [`/performance/cycle?cycle=${CYCLE}&view=insights`, "s6-26-insights-review", "By unit"],
      ]],
      ["sidebar.admin@example.test", [
        ["/", "s6-07-home-no-employee", "Home"],
      ]],
    ];
    for (const [email, pages] of shots) {
      const page = await signIn(browser, email, 1440);
      for (const [url, name, ready] of pages) {
        await open(page, url, ready);
        await save(page, name);
        if (name === "s6-26-insights-review") {
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.getByRole("button", { name: /^Not acknowledged in / }).first().click();
          await page.getByRole("dialog").getByRole("list").first().waitFor({ timeout: 60000 }).catch(() => {});
          await save(page, "s6-28-insights-drill");
          await page.keyboard.press("Escape");
          await page.getByRole("region", { name: "By manager" }).scrollIntoViewIfNeeded().catch(() => {});
          await save(page, "s6-27-insights-review-lower", 1200);
        }
      }
      await page.context().close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
