// Slice 3 taste-check screenshots (task 10.4), dark, 1440 wide (plus two at 1280x720), through the shell.
// Run after seed-conversations.cjs and journey-conversations.cjs. Changes data: none (composers are cancelled).
//   node .local-docs/agents/data/screens-conversations.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const OUT = path.join(__dirname, "../plans/B-070-slice-3-screens");

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
  // Let the page's queries land: a capture mid-fetch shows skeletons, not the screen.
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`saved ${name}.png`);
}

async function open(page, url, ready) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 180000 });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // Ids for deep links, read through the API like the pages do.
  const mariamToken = await login("mariam.gharbi@example.test");
  const list = (await call("GET", "/api/performance/one-on-ones", null, mariamToken)).json.data;
  const aichaRow = list.reports.find((r) => r.with.displayName.startsWith("Aicha"));
  const endedRow = list.ended[0];
  const leilaToken = await login("leila.baccouche@example.test");
  const request = (await call("GET", "/api/performance/feedback/requests", null, leilaToken)).json.data.mine[0];
  const praise = (await call("GET", "/api/performance/praise?limit=1", null, leilaToken)).json.data.items[0];
  const aichaId = aichaRow.with.employeeId;

  const browser = await chromium.launch();
  try {
    // 1-3. 1:1s as Mariam: the workspace, then the series with Aicha (and at 1280).
    const mariam = await signIn(browser, "mariam.gharbi@example.test");
    await open(mariam, "/performance/one-on-ones", "Your team");
    await save(mariam, "01-one-on-ones-manager");
    await open(mariam, `/performance/one-on-ones/${aichaRow.seriesId}`, "Next meeting");
    await save(mariam, "02-series-manager");
    const narrowMariam = await signIn(browser, "mariam.gharbi@example.test", { width: 1280, height: 720 });
    await open(narrowMariam, `/performance/one-on-ones/${aichaRow.seriesId}`, "Next meeting");
    await save(narrowMariam, "03-series-manager-1280x720");

    // 4. The same series as Aicha: her own private note, none of Mariam's.
    const aicha = await signIn(browser, "aicha.bouazizi@example.test");
    await open(aicha, `/performance/one-on-ones/${aichaRow.seriesId}`, "Next meeting");
    await save(aicha, "04-series-report");

    // 5. An ended series (Salah moved to Omar in the journey).
    if (endedRow) {
      await open(mariam, `/performance/one-on-ones/${endedRow.seriesId}`, "Ended");
      await save(mariam, "05-series-ended");
    }

    // 6-7. Feedback: Mariam's team view with a manager-only mark, then Requests.
    await open(mariam, "/performance/feedback?view=team", "Your team");
    await save(mariam, "06-feedback-team-manager-only");
    const leila = await signIn(browser, "leila.baccouche@example.test");
    await open(leila, "/performance/feedback?tab=requests", "Yours");
    await save(leila, "07-feedback-requests");

    // 8-9. The request as its requester and as an invitee.
    await open(leila, `/performance/feedback/requests/${request.id}`, "Answers");
    await save(leila, "08-request-requester");
    await open(aicha, `/performance/feedback/requests/${request.id}`, "Your feedback for");
    await save(aicha, "09-request-invitee");

    // 10-11. The composers (cancelled).
    await open(leila, "/performance/feedback", "Give feedback");
    await leila.getByRole("button", { name: "Give feedback" }).first().click();
    await leila.getByRole("dialog").waitFor();
    await save(leila, "10-feedback-composer", 800);
    await leila.getByRole("button", { name: "Cancel" }).click();
    await open(leila, "/performance/feedback?tab=praise&compose=praise", "Give praise");
    await leila.getByRole("dialog").waitFor();
    await save(leila, "11-praise-composer", 800);
    await leila.getByRole("button", { name: "Cancel" }).click();

    // 12. The Praise tab with a praise drawer open.
    await open(leila, `/performance/feedback?tab=praise&praise=${praise.id}`, "Praise");
    await leila.getByRole("dialog").waitFor();
    await save(leila, "12-praise-drawer");

    // 13. The objective drawer's Feedback section (Aicha's own objective: Ask for feedback on this).
    await open(aicha, "/performance/plan", "Automate the regression suite");
    await aicha.getByText("Automate the regression suite").first().click();
    await aicha.getByRole("button", { name: "Ask for feedback on this" }).scrollIntoViewIfNeeded();
    await save(aicha, "13-objective-drawer-feedback");

    // 14-15. The Fusion home with praise, also at 1280.
    const rim = await signIn(browser, "rim.mahjoub@example.test");
    await open(rim, "/", "Praise");
    await save(rim, "14-home-praise", 2500);
    const narrowRim = await signIn(browser, "rim.mahjoub@example.test", { width: 1280, height: 720 });
    await open(narrowRim, "/", "Praise");
    await save(narrowRim, "15-home-praise-1280x720", 2500);

    // 16. Core HR's Performance view of Aicha, as her manager: praise and feedback.
    const people = (await call("GET", `/api/performance/people/${aichaId}/summary`, null, mariamToken)).json.data;
    await open(mariam, `/core/people/${people.stableEmployeeKey}/performance`, "Praise");
    await save(mariam, "16-core-performance-view", 2500);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
