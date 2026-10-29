// B-095 task 6.1: the slice 4 and slice 6 boards no live Carthage could reach, captured from the demo presets (dark,
// 1440×900, through the shell). Slice 6 boards go to plans/B-070-slice-6-screens/live/s7-*.png, slice 4's closed round to
// plans/B-070-slice-4-screens/live/s7-07-round-closed.png. Reads demo-presets.local.json; changes no data.
//   node .local-docs/agents/data/screens-demo-presets.cjs [preset ...]   (default: every built preset)
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const SLICE6 = path.join(__dirname, "../plans/B-070-slice-6-screens/live");
const SLICE4 = path.join(__dirname, "../plans/B-070-slice-4-screens/live");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "demo-presets.local.json"), "utf8"));

// Per preset: [persona, route (from the preset's cycles), folder, file, text to wait for].
const SHOTS = {
  fresh: () => [
    ["Amira", "/performance", SLICE6, "s7-16-overview-hr-no-cycle", "Overview"],
  ],
  planning: () => [
    ["Aicha", "/performance", SLICE6, "s7-08-overview-employee-planning", "Overview"],
    ["Mariam", "/performance", SLICE6, "s7-12-overview-manager-planning", "Overview"],
    ["Mariam", "/performance/team", SLICE6, "s7-22-team-planning", "Aicha"],
    ["Amira", "/performance", SLICE6, "s7-18-overview-hr-planning", "Overview"],
  ],
  midyear: ({ current }) => [
    ["Aicha", "/performance", SLICE6, "s7-09-overview-employee-execution", "Overview"],
    ["Mariam", "/performance", SLICE6, "s7-13-overview-manager-execution", "Overview"],
    ["Mariam", "/performance/team", SLICE6, "s7-23-team-execution", "Aicha"],
    ["Amira", "/performance", SLICE6, "s7-19-overview-hr-execution", "Overview"],
    ["Amira", `/performance/cycle?cycle=${current.id}&view=insights`, SLICE6, "s7-26-insights-execution", "By unit"],
  ],
  nextcycle: ({ current, next }) => [
    ["Aicha", "/performance", SLICE6, "s7-11-overview-employee-closed", "Overview"],
    ["Mariam", "/performance", SLICE6, "s7-15-overview-manager-closed", "Overview"],
    ["Mariam", `/performance/team?cycle=${current.id}`, SLICE6, "s7-25-team-closed", "Aicha"],
    ["Amira", `/performance?cycle=${current.id}`, SLICE6, "s7-21-overview-hr-closed", "Overview"],
    ["Amira", `/performance?cycle=${next.id}`, SLICE6, "s7-17-overview-hr-draft", "Overview"],
    ["Amira", `/performance/cycle?cycle=${current.id}&view=insights`, SLICE6, "s7-27-insights-closed", "By unit"],
    ["Amira", `/performance/reviews/rounds/${current.roundId}`, SLICE4, "s7-07-round-closed", "Year-end review"],
  ],
};

async function signIn(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
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
  // A refused sign-in (an inactive tenant, a wrong password) stays on the sign-in form: never photograph it.
  const signedIn = await page.getByRole("complementary", { name: "Fusion navigation" }).first()
    .waitFor({ timeout: 120000 }).then(() => true, () => false);
  if (!signedIn) throw new Error(`Could not sign in as ${email}`);
  return page;
}

async function shoot(page, url, folder, name, ready) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.getByRole("complementary", { name: "Fusion navigation" }).first().waitFor({ timeout: 240000 });
  await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(folder, `${name}.png`) });
  console.log(`saved ${name}.png`);
}

(async () => {
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS).filter((k) => manifest.presets[k]);
  fs.mkdirSync(SLICE6, { recursive: true });
  fs.mkdirSync(SLICE4, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const key of keys) {
      const preset = manifest.presets[key];
      if (!preset || !SHOTS[key]) throw new Error(`No built preset "${key}" with screens`);
      const email = (name) => preset.personas.find((p) => p.name.startsWith(name)).email;
      const byPersona = new Map();
      for (const shot of SHOTS[key](preset.cycles)) {
        if (!byPersona.has(shot[0])) byPersona.set(shot[0], []);
        byPersona.get(shot[0]).push(shot.slice(1));
      }
      for (const [persona, shots] of byPersona) {
        const page = await signIn(browser, email(persona));
        for (const shot of shots) await shoot(page, ...shot);
        await page.context().close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
