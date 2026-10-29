// Slice 5 live screenshots, dark, 1440 wide, through the shell, into plans/B-070-slice-5-screens/live/, named after the
// boards they answer. Three phases around journey-calibration.cjs (see its header). Changes no data: dialogs, drawers
// and the drop form are opened and closed, never confirmed; AI drafts are asked for and discarded.
//   node .local-docs/agents/data/screens-calibration.cjs waiting|session|after
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const OUT = path.join(__dirname, "../plans/B-070-slice-5-screens/live");
const phase = process.argv[2] ?? "waiting";
const slug = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const emailOf = (name) => { const [first, ...rest] = name.split(" "); return `${slug(first)}.${slug(rest.join(" "))}@example.test`; };

async function signIn(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
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
  const tokens = {};
  const as = async (email) => (tokens[email] ??= await login(email));
  const get = async (email, url) => (await call("GET", url, null, await as(email))).json.data;
  const amiraEmail = "amira.khelifi@example.test";
  const round = (await get(amiraEmail, `/api/performance/cycles/${CYCLE}/review-rounds`)).find((r) => r.name === "Year-end review");
  const calibration = `/performance/reviews/rounds/${round.id}/calibration`;
  const api = `/api/performance/review-rounds/${round.id}/calibration`;
  const session = await get(amiraEmail, api);
  const people = (await get(amiraEmail, `${api}/people`)).groups.flatMap((g) => g.people);
  const omarId = session.header.managers.find((m) => m.name === "Omar Mansour").id;
  const changedOmar = people.filter((p) => p.reviewerName === "Omar Mansour" && p.currentRating !== p.originalRating).sort((a, b) => a.name.localeCompare(b.name));
  const inCalibration = people.find((p) => p.reviewerName === "Omar Mansour" && p.currentRating === p.originalRating);

  const browser = await chromium.launch();
  try {
    if (phase === "waiting") {
      // 02. The session waits on two reviews.
      const amira = await signIn(browser, amiraEmail);
      await open(amira, `${calibration}?view=distribution`, "Still with managers");
      await save(amira, "02-session-waiting");

      // 12. Mariam drafts Aicha's summary.
      const mariam = await signIn(browser, "mariam.gharbi@example.test");
      const aichaRow = (await get("mariam.gharbi@example.test", `/api/performance/reviews/workspace?cycle=${CYCLE}`)).toWrite
        .find((r) => r.subjectDisplayName === "Aicha Bouazizi");
      await open(mariam, `/performance/reviews/${aichaRow.reviewId}`, "Overall");
      await mariam.getByRole("button", { name: "Draft from Aicha's year" }).click();
      await mariam.getByText(/sources|Too little/).first().waitFor({ timeout: 30000 }).catch(() => {});
      await mariam.getByRole("region", { name: "Draft from Aicha's year" }).scrollIntoViewIfNeeded().catch(() => {});
      await save(mariam, "12-manager-ai-draft");

      // 16. The person still writing starts from their year.
      const held = session.header.outstandingByReviewer.find((g) => g.reviewerName === "Omar Mansour")?.people[0];
      if (held) {
        const person = await signIn(browser, emailOf(held));
        const own = (await get(emailOf(held), `/api/performance/reviews/workspace?cycle=${CYCLE}`)).own;
        await open(person, `/performance/reviews/${own.reviewId}`, "Your overall view");
        await person.getByRole("button", { name: "Start from your year" }).click();
        await person.getByText(/sources you can see|Too little/).first().waitFor({ timeout: 30000 }).catch(() => {});
        await person.getByRole("region", { name: "Start from your year" }).scrollIntoViewIfNeeded().catch(() => {});
        await save(person, "16-self-reflection-starter");
      }

      // 14 (before) and 17 (before): Omar's team in calibration, and one of his people's own review.
      const omar = await signIn(browser, "omar.mansour@example.test");
      await open(omar, `/performance/reviews?cycle=${CYCLE}`, "In calibration");
      await save(omar, "14a-manager-before");
      const subject = await signIn(browser, emailOf(inCalibration.name));
      await open(subject, `/performance/reviews/${inCalibration.reviewId}`, "Calibration");
      await save(subject, "17a-employee-before");
    }

    if (phase === "session") {
      const amira = await signIn(browser, amiraEmail);
      // 11. HR's Reviews page leads with the session.
      await open(amira, `/performance/reviews?cycle=${CYCLE}`, "Open the session");
      await save(amira, "11-facilitator-reviews");
      // 03, 04, 05, 08.
      await open(amira, `${calibration}?view=distribution`, "By manager");
      await save(amira, "03-session-distribution");
      await open(amira, calibration, "Last cycle");
      await save(amira, "04-session-people");
      await open(amira, `${calibration}?view=nine-box&manager=${omarId}`, "Potential");
      await save(amira, "05-session-ninebox");
      await open(amira, `${calibration}?flagged=true`, "Last cycle");
      await save(amira, "08-flags");

      // 06. The drawer on a changed person.
      await open(amira, calibration, "Last cycle");
      await amira.getByRole("button", { name: new RegExp(changedOmar[0].name) }).first().click();
      await amira.getByRole("radiogroup", { name: "Calibrated rating" }).waitFor({ timeout: 30000 });
      await save(amira, "06-adjust-rating", { full: false });
      await amira.keyboard.press("Escape");

      // 07. The drop form, from the keyboard; closed without moving.
      await open(amira, `${calibration}?view=nine-box&manager=${omarId}`, "Potential");
      const chip = amira.locator('button[aria-keyshortcuts="M"]').first();
      await chip.focus();
      await amira.keyboard.press("m");
      await amira.getByRole("button", { name: "Move here" }).first().click();
      await amira.getByRole("dialog").waitFor({ timeout: 15000 });
      await save(amira, "07-ninebox-drop", { full: false });
      await amira.getByRole("button", { name: "Cancel" }).click();

      // 09. The finalize confirmation, kept open and cancelled.
      await open(amira, calibration, "Last cycle");
      await amira.getByRole("button", { name: "Finalize calibration" }).click();
      await amira.getByText("When you finalize").waitFor({ timeout: 30000 });
      await save(amira, "09-finalize", { full: false });
      await amira.getByRole("button", { name: "Keep discussing" }).click();

      // 18. No one matches.
      await open(amira, `${calibration}?q=zzzz`, "No one matches");
      await save(amira, "18-no-one-matches", { full: false });
    }

    if (phase === "after") {
      const amira = await signIn(browser, amiraEmail);
      await open(amira, calibration, "Where ratings landed");
      await save(amira, "10-finalized");
      const omar = await signIn(browser, "omar.mansour@example.test");
      await open(omar, `/performance/reviews?cycle=${CYCLE}`, "Changed in calibration");
      await save(omar, "14b-manager-after");
      const unreleased = changedOmar.find((p) => p !== changedOmar[0]) ?? changedOmar[0];
      await open(omar, `/performance/reviews/${unreleased.reviewId}`, "After calibration");
      await save(omar, "15-manager-calibrated-review");
      const released = await signIn(browser, emailOf(changedOmar[0].name));
      await open(released, `/performance/reviews/${changedOmar[0].reviewId}`, "Acknowledge");
      await save(released, "17b-employee-after");
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
