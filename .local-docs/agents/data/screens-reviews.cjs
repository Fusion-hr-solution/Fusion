// Slice 4 live screenshots, dark, 1440 wide, through the shell, into plans/B-070-slice-4-screens/live/, named after the
// boards they answer. Run after seed-reviews.cjs and journey-reviews.cjs. Changes no data (popovers are opened, never submitted).
//   node .local-docs/agents/data/screens-reviews.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const OUT = path.join(__dirname, "../plans/B-070-slice-4-screens/live");

async function signIn(browser, email, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  await context.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}/performance`, { waitUntil: "domcontentloaded", timeout: 240000 });
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

async function save(page, name, { settle = 1500, full = true } = {}) {
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
  const token = async (who) => login(`${who}@example.test`);
  const get = async (who, url) => (await call("GET", url, null, await token(who))).json.data;
  const amiraRounds = await get("amira.khelifi", `/api/performance/cycles/${CYCLE}/review-rounds`);
  const yearEnd = amiraRounds.find((r) => r.name === "Year-end review");
  const spot = amiraRounds.find((r) => r.name === "Product launch spot review");
  const mariamWork = await get("mariam.gharbi", `/api/performance/reviews/workspace?cycle=${CYCLE}`);
  const aichaReview = mariamWork.toWrite.find((r) => r.subjectDisplayName.startsWith("Aicha")).reviewId;
  const sofieneReview = mariamWork.toWrite.find((r) => r.subjectDisplayName.startsWith("Sofiene"))?.reviewId;
  const mariamOwn = mariamWork.own.reviewId;
  const leilaOwn = (await get("leila.baccouche", `/api/performance/reviews/workspace?cycle=${CYCLE}`)).own.reviewId;
  const omarAsk = (await get("omar.mansour", `/api/performance/reviews/workspace?cycle=${CYCLE}`)).askedOfYou.find((r) => r.state === "Open");

  const browser = await chromium.launch();
  try {
    // 01, 08. Leila: her own review leads; then writing it.
    const leila = await signIn(browser, "leila.baccouche@example.test");
    await open(leila, `/performance/reviews?cycle=${CYCLE}`, "Your year");
    await save(leila, "01-reviews-employee");
    await open(leila, `/performance/reviews/${leilaOwn}`, "Your overall view");
    await save(leila, "08-self-assessment");

    // 09. Aicha's submitted self-assessment.
    const aicha = await signIn(browser, "aicha.bouazizi@example.test");
    await open(aicha, `/performance/reviews/${aichaReview}`, "What you sent");
    await save(aicha, "09-self-submitted");

    // 02, 10, 12, 13. Mariam: her team, Aicha's (approved) peer list, writing Aicha's review, her own released result.
    const mariam = await signIn(browser, "mariam.gharbi@example.test");
    await open(mariam, `/performance/reviews?cycle=${CYCLE}`, "Your team");
    await save(mariam, "02-reviews-manager");
    await open(mariam, `/performance/reviews?cycle=${CYCLE}&peers=${aichaReview}`, "Peers for");
    await save(mariam, "10-peer-list", { full: false });
    await open(mariam, `/performance/reviews/${aichaReview}`, "From Aicha");
    await save(mariam, "12-manager-assessment");
    await open(mariam, `/performance/reviews/${mariamOwn}`, "Your result");
    await save(mariam, "13-result-released");

    // 11. Omar's open peer request for Aicha.
    if (omarAsk) {
      const omar = await signIn(browser, "omar.mansour@example.test");
      await open(omar, `/performance/reviews/peer-requests/${omarAsk.requestId}`, "Read by");
      await save(omar, "11-peer-input");
    }

    // 03, 04/05, 06, 14, 17. Amira: the running round, the blocked draft, the running round with its due-date popover,
    // Sofiene's review with its own move open, Settings › Reviews.
    const amira = await signIn(browser, "amira.khelifi@example.test");
    await open(amira, `/performance/reviews?cycle=${CYCLE}`, "Running");
    await save(amira, "03-reviews-hr");
    if (spot) {
      await open(amira, `/performance/reviews/rounds/${spot.id}?cycle=${CYCLE}`, "Another round is running");
      await save(amira, "05-round-launch-blocked");
      await save(amira, "04-round-setup");
    }
    await open(amira, `/performance/reviews/rounds/${yearEnd.id}?cycle=${CYCLE}`, "By team");
    await save(amira, "06-round-running");
    await amira.getByRole("button", { name: "Due dates" }).click();
    await amira.getByText("Move due dates").first().waitFor();
    await save(amira, "06b-round-move-due-dates", { full: false });
    await amira.keyboard.press("Escape");
    if (sofieneReview) {
      await open(amira, `/performance/reviews/${sofieneReview}`, "Activity");
      await save(amira, "14-review-hr-lens");
      await amira.getByRole("button", { name: "Move due date" }).click();
      await amira.getByText("Only this review").first().waitFor();
      await save(amira, "14b-review-move-due-date", { full: false });
      await amira.keyboard.press("Escape");
    }
    await open(amira, "/performance/settings", "Question library");
    await amira.getByText("Question library").first().scrollIntoViewIfNeeded();
    await save(amira, "17-settings-reviews");
  } finally {
    await browser.close();
  }

  // 15. The PDF itself: Mariam's copy of her released review.
  const response = await fetch(`${BASE}/api/performance/reviews/${mariamOwn}/pdf`, { headers: { Authorization: `Bearer ${await token("mariam.gharbi")}` } });
  fs.writeFileSync(path.join(OUT, "15-review-pdf.pdf"), Buffer.from(await response.arrayBuffer()));
  console.log(`saved 15-review-pdf.pdf (${response.status})`);
})().catch((error) => { console.error(error); process.exit(1); });
