// B-087 screenshots of the rebuilt slice 3 surfaces, dark, 1440 wide (plus one at 1280x720), through the shell, into
// plans/B-087-screens/live/. Run after seed-conversations.cjs and journey-conversations.cjs. Changes no data
// (composers are cancelled).
//   node .local-docs/agents/data/screens-conversations-redesign.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const OUT = path.join(__dirname, "../plans/B-087-screens/live");

async function signIn(browser, email, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  await context.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}/performance`, { waitUntil: "domcontentloaded", timeout: 240000 });
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

async function save(page, name, { settle = 1500, full = true } = {}) {
  // Let the page's queries land: a capture mid-fetch shows skeletons, not the screen.
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`saved ${name}.png`);
}

async function open(page, url, ready) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 180000 });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mariamToken = await login("mariam.gharbi@example.test");
  const list = (await call("GET", "/api/performance/one-on-ones", null, mariamToken)).json.data;
  const aichaRow = list.reports.find((r) => r.with.displayName.startsWith("Aicha"));
  const endedRow = list.ended[0];
  const leilaToken = await login("leila.baccouche@example.test");
  const request = (await call("GET", "/api/performance/feedback/requests", null, leilaToken)).json.data.mine[0];
  const received = (await call("GET", "/api/performance/feedback?view=received&limit=1", null, await login("aicha.bouazizi@example.test"))).json.data.items[0];
  const praise = (await call("GET", "/api/performance/praise?limit=1", null, leilaToken)).json.data.items[0];

  const browser = await chromium.launch();
  try {
    // 01-02. 1:1s as Mariam: next up and the team's rhythm, then the series with Aicha.
    const mariam = await signIn(browser, "mariam.gharbi@example.test");
    await open(mariam, "/performance/one-on-ones", "Your team");
    await save(mariam, "01-one-on-ones-manager");
    await open(mariam, `/performance/one-on-ones/${aichaRow.seriesId}`, "Talking points");
    await save(mariam, "03-series-manager");
    const narrow = await signIn(browser, "mariam.gharbi@example.test", { width: 1280, height: 720 });
    await open(narrow, `/performance/one-on-ones/${aichaRow.seriesId}`, "Talking points");
    await save(narrow, "03b-series-manager-1280x720", { full: false });

    // 02. No 1:1s yet: Rim's page is starting them with her manager.
    const rim = await signIn(browser, "rim.mahjoub@example.test");
    await open(rim, "/performance/one-on-ones", "1:1s with");
    await save(rim, "02-one-on-ones-start");

    // 03c. The same series as Aicha.
    const aicha = await signIn(browser, "aicha.bouazizi@example.test");
    await open(aicha, `/performance/one-on-ones/${aichaRow.seriesId}`, "Talking points");
    await save(aicha, "03c-series-report");

    // 04. An ended series.
    if (endedRow) {
      await open(mariam, `/performance/one-on-ones/${endedRow.seriesId}`, "Over the series");
      await save(mariam, "04-series-ended");
    }

    // 05. Received as Aicha (summary band, ask about), and Mariam's team view.
    await open(aicha, "/performance/feedback", "Received");
    await save(aicha, "05-feedback-received");
    await open(mariam, "/performance/feedback?view=team", "Your team");
    await save(mariam, "05b-feedback-team");

    // 06. Requests: Aicha has one asked of her; Leila's own with who answered.
    await open(aicha, "/performance/feedback?tab=requests", "Asked of you");
    await save(aicha, "06-requests-invitee");
    const leila = await signIn(browser, "leila.baccouche@example.test");
    await open(leila, "/performance/feedback?tab=requests", "Yours");
    await save(leila, "06b-requests-requester");

    // 07. The Praise tab.
    await open(leila, "/performance/feedback?tab=praise", "What we celebrate");
    await save(leila, "07-praise");

    // 08-09. The request as its requester and as an invitee.
    await open(leila, `/performance/feedback/requests/${request.id}`, "Answers");
    await save(leila, "08-request-requester");
    await open(aicha, `/performance/feedback/requests/${request.id}`, "asked you");
    await save(aicha, "09-request-invitee");

    // 10-11. The composers (cancelled).
    await open(leila, "/performance/feedback", "Received");
    await leila.getByRole("button", { name: "Give feedback" }).first().click();
    await leila.getByRole("dialog").waitFor();
    await save(leila, "10-feedback-composer", { settle: 800, full: false });
    await leila.getByRole("button", { name: "Cancel" }).click();
    await open(leila, "/performance/feedback?tab=praise&compose=praise", "What we celebrate");
    await leila.getByRole("dialog").waitFor();
    await save(leila, "11-praise-composer", { settle: 800, full: false });
    await leila.getByRole("button", { name: "Cancel" }).click();

    // 12. Drawers: feedback (Aicha's received) and praise.
    if (received) {
      await open(aicha, `/performance/feedback?feedback=${received.id}`, "Received");
      await aicha.getByRole("dialog").waitFor();
      await save(aicha, "12-feedback-drawer", { full: false });
    }
    await open(leila, `/performance/feedback?tab=praise&praise=${praise.id}`, "What we celebrate");
    await leila.getByRole("dialog").waitFor();
    await save(leila, "12b-praise-drawer", { full: false });

    // 13. The Fusion home's praise with the redesigned card.
    await open(rim, "/", "Praise");
    await save(rim, "13-home-praise", { settle: 2500 });
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
