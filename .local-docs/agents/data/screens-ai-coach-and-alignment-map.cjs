// Slice 2b taste-check screenshots (task 9.5), dark, 1440 wide (plus the map at 1280x720), through the shell.
// Run after seed-alignment-map.cjs. The coach screens use the real AI provider (GROQ_API_KEY in Performance);
// only the "nothing to suggest" screen is staged, by answering one coach request in the browser.
// Changes data: none (composers are cancelled, never saved).
//   node .local-docs/agents/data/screens-ai-coach-and-alignment-map.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const OUT = path.join(__dirname, "../plans/B-070-slice-2b-screens");

async function signIn(browser, email, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  await context.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}/performance`, { waitUntil: "domcontentloaded" });
  for (let attempt = 0; attempt < 4 && new URL(page.url()).pathname.includes("signin"); attempt++) {
    const emailBox = page.locator('input[type="email"], input[name="email"]').first();
    await emailBox.waitFor({ timeout: 240000 });
    await page.waitForTimeout(800); // let hydration settle so the fill isn't reset
    await emailBox.fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    if ((await emailBox.inputValue()) !== email) continue;
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("signin"), { timeout: 30000 }).catch(() => {});
  }
  if (new URL(page.url()).pathname.includes("signin")) throw new Error(`Could not sign in as ${email}`);
  return page;
}

async function save(page, name, settle = 1500) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`saved ${name}.png`);
}

async function open(page, url, ready) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 180000 });
}

const firstSuggestion = (page) => page.getByRole("group", { name: /^Suggested / }).first().waitFor({ timeout: 45000 });

/**
 * Opens a composer and waits for real suggestions. A failed or slow first call hides the coach for that
 * composer session (B-082), so a miss is retried once in a fresh session, asking on request.
 */
async function composeWithSuggestions(page, openComposer, fill) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await openComposer();
    await fill();
    if (attempt === 2) await page.getByRole("button", { name: "Suggest improvements" }).click({ timeout: 15000 });
    try {
      await firstSuggestion(page);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      console.log("note: no suggestion on the first try (coach hidden after a slow call); retrying in a fresh composer");
      await page.getByRole("button", { name: "Cancel" }).click();
    }
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    // 1-2. Leila's plan composer: real suggestions, then one applied.
    const leila = await signIn(browser, "leila.baccouche@example.test");
    await open(leila, "/performance/plan", "Add objective");
    await composeWithSuggestions(
      leila,
      () => leila.getByRole("button", { name: "Add objective" }).first().click(),
      async () => {
        await leila.getByLabel(/^Title/).fill("Improve onboarding");
        await leila.getByLabel(/^Description/).fill("New joiners take too long to become productive.");
        await leila.getByRole("button", { name: /Manual percentage/ }).click();
      }
    );
    await save(leila, "01-plan-composer-suggestions");
    const measure = leila.getByRole("group", { name: "Suggested measure" });
    const apply = (await measure.count()) ? measure : leila.getByRole("group", { name: /^Suggested / }).first();
    await apply.getByRole("button", { name: "Apply" }).click();
    await save(leila, "02-plan-composer-after-apply");

    // 3. Nothing to suggest (staged: the coach request is answered in the browser).
    await leila.route("**/objective-coach", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ data: { outcome: "NothingToSuggest", title: null, measure: null, parentObjectiveId: null }, isSuccess: true, errors: [] }),
    }));
    await leila.getByRole("button", { name: "Suggest improvements" }).click();
    await leila.getByText("No suggestions for this objective").waitFor({ timeout: 15000 });
    await save(leila, "03-plan-composer-nothing-to-suggest");
    await leila.unrouteAll();

    // 4. Mariam's team composer, standalone, so a suggested parent shows.
    const mariam = await signIn(browser, "mariam.gharbi@example.test");
    await open(mariam, "/performance/team", "Create team objective");
    await composeWithSuggestions(
      mariam,
      async () => {
        await mariam.getByText(/Choose an upstream objective|No alignment/).first().click();
        await mariam.getByRole("option", { name: /No alignment/ }).click();
        await mariam.getByRole("button", { name: "Create team objective" }).click();
      },
      () => mariam.getByLabel(/^Title/).fill("Reduce production incidents across platform services")
    );
    await mariam.getByRole("group", { name: "Suggested parent" }).waitFor({ timeout: 10000 }).catch(() => console.log("note: no parent suggested this run"));
    await save(mariam, "04-team-composer-suggestions");

    // 5-8. The map: employee, manager with personal objectives open, HR, and HR at 1280x720.
    const rim = await signIn(browser, "rim.mahjoub@example.test");
    await open(rim, "/performance/goals", "Build a resilient");
    await save(rim, "05-map-employee", 2500);

    await open(mariam, "/performance/goals", "Build a resilient");
    await mariam.getByRole("button", { name: /^3 personal objectives/ }).click();
    await save(mariam, "06-map-manager-personal-open", 2500);

    const amira = await signIn(browser, "amira.khelifi@example.test");
    await open(amira, "/performance/goals", "Build a resilient");
    await save(amira, "07-map-hr", 2500);
    const narrow = await signIn(browser, "amira.khelifi@example.test", { width: 1280, height: 720 });
    await open(narrow, "/performance/goals", "Build a resilient");
    await save(narrow, "08-map-hr-1280x720", 2500);

    // 9. The map focused from an objective record ("View on map" on Aicha's aligned objective).
    const aicha = await signIn(browser, "aicha.bouazizi@example.test");
    await open(aicha, "/performance/plan", "Automate the regression suite");
    await aicha.getByText("Automate the regression suite").first().click();
    await aicha.getByRole("link", { name: "View on map" }).click();
    await aicha.waitForURL(/\/goals\?/, { timeout: 60000 });
    await aicha.getByText("Build a resilient").first().waitFor({ timeout: 120000 });
    await save(aicha, "09-map-focused-from-record", 3000);

    // 10-11. The List view and the AI switch in Settings.
    await open(amira, "/performance/goals?view=list", "Organization direction");
    await save(amira, "10-list-view", 3000);
    await open(amira, "/performance/settings", "AI assistance");
    await amira.getByRole("heading", { name: "AI assistance" }).scrollIntoViewIfNeeded();
    await save(amira, "11-settings-ai-switch");

    // 12. Core HR's org chart on the shared React Flow parts (no visible change expected).
    await amira.goto(`${BASE}/core/organization`, { waitUntil: "domcontentloaded" });
    await amira.locator(".react-flow__node").first().waitFor({ timeout: 180000 });
    await save(amira, "12-core-org-chart", 2500);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
