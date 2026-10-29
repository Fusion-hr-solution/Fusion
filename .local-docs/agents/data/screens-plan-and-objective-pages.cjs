// Slice 2a taste-check screenshots (task 9.3), dark, 1440 wide (plus one at 1280x720), through the shell.
// Run after journey-plan-and-objective-pages.cjs (Aicha's approved plan). Creates its own states through the
// product API: Mariam asks Aicha for an update on her manual objective; Sofiene Jebali (CDG, Mariam's report)
// is activated through the invite flow, writes and submits a plan, is returned with two change requests
// drafted in the UI, addresses them and resubmits. Runs once against that fixture.
//   node .local-docs/agents/data/screens-plan-and-objective-pages.cjs
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD, call, login, inviteToken } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const OUT = path.join(__dirname, "../plans/B-070-slice-2a-screens");
const { CYCLE, employee } = require("./carthage-ids.cjs");
const AICHA_KEY = "E-DD77F6827F064E90A603667DC8809DE7";
const SOFIENE = employee("CDG-046");
const SOFIENE_EMAIL = "sofiene.jebali@example.test";
const api = `/api/performance/cycles/${CYCLE}`;
const data = (r) => r.json?.data;

async function ensureAccount(employeeId, email, first, last) {
  try { return await login(email); } catch { /* invite below */ }
  const amira = await login("amira.khelifi@example.test");
  const r = await call("POST", `/api/corehr/workforce/access-subjects/${employeeId}/activate`, { employeeId, baseline: "Employee", expectedVersion: 0 }, amira);
  if (r.status !== 200) throw new Error(`activate ${email}: ${r.status}`);
  const invitation = await inviteToken(email);
  const accept = await fetch(`${BASE}/api/identity/invites/${encodeURIComponent(invitation.token)}/accept`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: first, lastName: last, password: PASSWORD }),
  });
  if (!accept.ok) throw new Error(`accept ${email}: ${accept.status}`);
  return login(email);
}

async function signIn(browser, email, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, colorScheme: "dark" });
  await context.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}/performance`, { waitUntil: "domcontentloaded" });
  for (let attempt = 0; attempt < 4 && new URL(page.url()).pathname.includes("signin"); attempt++) {
    const emailBox = page.locator('input[type="email"], input[name="email"]').first();
    await emailBox.waitFor();
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

async function shot(page, name, url, { ready, before } = {}) {
  if (url) await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  if (ready) await page.getByText(ready, { exact: false }).first().waitFor({ timeout: 180000 });
  // The Development section loads after the plan; wait for it to settle wherever it shows.
  await page.locator('[aria-label="Loading development"]').waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  if (before) await before(page);
  await page.waitForTimeout(4000); // let the plan's secondary queries (requests, development) settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`saved ${name}.png`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mariamToken = await login("mariam.gharbi@example.test");

  // Aicha: a fresh update request on her manual objective, for the card marker and drawer band.
  const aichaPlan = data(await call("GET", `${api}/plan`, null, await login("aicha.bouazizi@example.test"))).plan;
  const manual = aichaPlan.objectives.find((o) => o.measurement?.method === "ManualPercentage");
  const milestoneObjective = aichaPlan.objectives.find((o) => o.measurement?.method === "WeightedMilestones");
  await call("POST", `${api}/plans/${aichaPlan.id}/update-requests`, { objectiveId: manual.id, note: "How far along are the suites?" }, mariamToken);

  // Sofiene: account, plan with two objectives.
  const sofieneToken = await ensureAccount(SOFIENE, SOFIENE_EMAIL, "Sofiene", "Jebali");
  let sPlan = data(await call("GET", `${api}/plan`, null, sofieneToken)).plan;
  if (!sPlan) {
    const targets = data(await call("GET", `${api}/plan/alignment-targets`, null, sofieneToken));
    const cycleVersion = data(await call("GET", `/api/performance/cycles/${CYCLE}`, null, sofieneToken)).cycle.version;
    sPlan = data(await call("POST", `${api}/plan`, { expectedVersion: cycleVersion }, sofieneToken));
    sPlan = data(await call("POST", `${api}/plan/objectives`, { title: "Cut client onboarding to two weeks", description: null, parentObjectiveId: targets[0].id,
      startDate: null, endDate: null, measurement: { method: "NumericTarget", baseline: 30, target: 14, unit: "days", direction: "Decrease" }, planWeight: 60, expectedVersion: sPlan.version }, sofieneToken));
    sPlan = data(await call("POST", `${api}/plan/objectives`, { title: "Write the delivery playbook", description: null, parentObjectiveId: null,
      startDate: null, endDate: null, measurement: { method: "ManualPercentage" }, planWeight: 40, expectedVersion: sPlan.version }, sofieneToken));
  }

  const browser = await chromium.launch();
  const aicha = await signIn(browser, "aicha.bouazizi@example.test");
  const sofiene = await signIn(browser, SOFIENE_EMAIL);
  const mariam = await signIn(browser, "mariam.gharbi@example.test");
  const amira = await signIn(browser, "amira.khelifi@example.test");
  amira.setDefaultNavigationTimeout(240000);

  // 1. Approved My Plan with statuses, a request marker, the approved rail and Development.
  await shot(aicha, "01-my-plan-approved", `/performance/plan`, { ready: "Lead a test-strategy review" });
  await aicha.screenshot({ path: path.join(OUT, "01b-my-plan-approved-full.png"), fullPage: true });

  // 2. The drawer recording a check-in at risk, opened from the card so it shows over My Plan with the request band.
  await aicha.goto(`${BASE}/performance/plan`, { waitUntil: "domcontentloaded" });
  await aicha.getByRole("button", { name: /Update progress/ }).first().waitFor({ timeout: 180000 });
  await aicha.getByRole("button", { name: /Update progress/ }).first().click();
  await shot(aicha, "02-drawer-check-in-at-risk", null, {
    ready: "How it's going",
    before: async (p) => {
      await p.getByRole("radio", { name: "At risk" }).click();
      await p.getByLabel("What's in the way").fill("Two suites wait on the new test environment, due mid-November.");
      await p.getByText("asked for an update").first().scrollIntoViewIfNeeded();
    },
  });
  // 2b. The objective's details with status and acknowledgement (milestone objective), full page.
  await shot(aicha, "02b-drawer-status", `/performance/cycles/${CYCLE}/objectives/${milestoneObjective.id}`, { ready: "How it's going" });
  await aicha.screenshot({ path: path.join(OUT, "02b-drawer-status.png"), fullPage: true });

  // 6a. Side panel in Draft.
  await shot(sofiene, "06a-rail-draft", `/performance/plan`, { ready: "Starts once the plan is approved" });

  // Submit, then 6b. Side panel in review.
  sPlan = data(await call("GET", `${api}/plan`, null, sofieneToken)).plan;
  if (sPlan.state === "Draft") sPlan = data(await call("POST", `${api}/plan/submit`, { expectedVersion: sPlan.version }, sofieneToken));
  await shot(sofiene, "06b-rail-submitted", `/performance/plan`, { ready: "In review" });

  // 4. Mariam drafts two change requests on the cards.
  const planUrl = `/performance/cycles/${CYCLE}/plans/${sPlan.id}`;
  await mariam.goto(`${BASE}${planUrl}`, { waitUntil: "domcontentloaded" });
  await mariam.getByRole("button", { name: /Request a change/ }).first().waitFor({ timeout: 180000 });
  const texts = ["Name the baseline you measured the 30 days from.", "Split this into the sections you'll write."];
  for (const text of texts) {
    await mariam.getByRole("button", { name: /Request a change/ }).first().click();
    await mariam.getByLabel("What should change").fill(text);
    await mariam.getByRole("button", { name: "Save change" }).click();
  }
  await shot(mariam, "04-reviewer-drafting-changes", null, { ready: "Return with 2 changes" });
  mariam.on("dialog", (d) => d.accept());
  await mariam.getByRole("button", { name: /Return with 2 changes/ }).first().click();
  await mariam.getByRole("dialog").getByRole("button", { name: /Return with 2 changes/ }).click();
  await mariam.getByText("Returned for changes").first().waitFor({ timeout: 30000 });

  // 3. Sofiene's returned plan with the requests on the cards.
  await shot(sofiene, "03-owner-returned-with-changes", `/performance/plan`, { ready: "asked for a change" });

  // Address both (one with a reply, after editing that objective), resubmit; 5. Mariam reads the outcomes.
  sPlan = data(await call("GET", `${api}/plan`, null, sofieneToken)).plan;
  const ret = sPlan.history.at(-1);
  const numeric = sPlan.objectives.find((o) => o.title.startsWith("Cut"));
  sPlan = data(await call("PUT", `${api}/plan/objectives/${numeric.id}`, { title: "Cut client onboarding from 30 to 14 days", description: null,
    parentObjectiveId: numeric.parentObjectiveId, startDate: null, endDate: null,
    measurement: { method: "NumericTarget", baseline: 30, target: 14, unit: "days", direction: "Decrease" }, planWeight: 60, expectedVersion: sPlan.version }, sofieneToken));
  for (const request of ret.changeRequests) {
    sPlan = data(await call("POST", `${api}/plan/change-requests/${request.id}/address`, {
      reply: request.objectiveId === numeric.id ? "Baseline is the Q3 average, now in the title." : null, expectedVersion: sPlan.version }, sofieneToken));
  }
  await call("POST", `${api}/plan/submit`, { expectedVersion: sPlan.version }, sofieneToken);
  await shot(mariam, "05-reviewer-resubmission-outcomes", planUrl, { ready: "You asked" });

  // 6c. Approved rail from the reviewer lens (Aicha's plan), 1280x720 check.
  await shot(mariam, "06c-rail-approved-reviewer", `/performance/cycles/${CYCLE}/plans/${aichaPlan.id}`, { ready: "Approved & locked" });
  const small = await signIn(browser, "aicha.bouazizi@example.test", { width: 1280, height: 720 });
  await shot(small, "07-my-plan-1280x720", `/performance/plan`, { ready: "Objectives" });

  // 8. Core HR Performance view with status and development.
  await shot(amira, "08-corehr-performance-view", `/core/people/${AICHA_KEY}/performance`, { ready: "Development" });

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
