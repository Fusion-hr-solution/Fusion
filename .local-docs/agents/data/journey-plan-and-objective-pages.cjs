// API journey for the extend-plan-and-objective-pages change (task 9.1), through the shell's /api.
// Aicha Bouazizi (CDG-027, reviewed by Mariam Gharbi) is activated through the workforce invite flow if she
// has no account yet, then: writes and submits a plan; Mariam returns it with two change requests; Aicha
// addresses one, is refused resubmission, addresses the other and resubmits; Mariam approves and asks for an
// update on the milestone objective; Aicha records a two-milestone check-in At risk, which answers the
// request and notifies Mariam; Mariam's work list carries the attention item until she acknowledges it;
// each adds a development goal and the other is notified; the person summary shows status and development.
// Changes data: Aicha gets an account, an approved FY2027 plan, progress, a status and development goals.
// Runs once against a Carthage fixture where Aicha has no plan.
//   node .local-docs/agents/data/journey-plan-and-objective-pages.cjs
const path = require("path");
const { BASE, PASSWORD, call, login, inviteToken } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const { CYCLE, employee } = require("./carthage-ids.cjs");
const AICHA = employee("CDG-027");
const AICHA_EMAIL = "aicha.bouazizi@example.test";
const MARIAM = employee("CDG-005");

let failed = 0;
const log = (step, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? `  (${detail})` : ""}`);
};
const data = (r) => r.json?.data;
const err = (r) => (r.status >= 400 ? `${r.json?.details?.code ?? ""} ${r.json?.errors?.[0] ?? ""}`.trim() : "");

async function ensureAccount() {
  try {
    return await login(AICHA_EMAIL);
  } catch {
    const amira = await login("amira.khelifi@example.test");
    const activation = await call("POST", `/api/corehr/workforce/access-subjects/${AICHA}/activate`,
      { employeeId: AICHA, baseline: "Employee", expectedVersion: 0 }, amira);
    log("Activate Aicha's workforce access (invite)", activation.status === 200, `${activation.status}`);
    const invitation = await inviteToken(AICHA_EMAIL);
    const accept = await fetch(`${BASE}/api/identity/invites/${encodeURIComponent(invitation.token)}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Aicha", lastName: "Bouazizi", password: PASSWORD }),
    });
    log("Aicha accepts her invitation", accept.ok, `${accept.status}`);
    return await login(AICHA_EMAIL);
  }
}

(async () => {
  const aicha = await ensureAccount();
  const mariam = await login("mariam.gharbi@example.test");
  const plans = `/api/performance/cycles/${CYCLE}`;

  // 1. Aicha writes and submits her plan: one aligned manual objective, one standalone milestone objective.
  let r = await call("GET", `${plans}/plan`, null, aicha);
  if (data(r)?.plan) throw new Error("Aicha already has a plan; this journey runs once on a fresh fixture.");
  const targets = data(await call("GET", `${plans}/plan/alignment-targets`, null, aicha));
  const cycleVersion = data(await call("GET", `/api/performance/cycles/${CYCLE}`, null, aicha)).cycle.version;
  r = await call("POST", `${plans}/plan`, { expectedVersion: cycleVersion }, aicha);
  let plan = data(r);
  log("Aicha creates her plan", r.status === 200 && plan?.state === "Draft", `${r.status}`);
  r = await call("POST", `${plans}/plan/objectives`, {
    title: "Automate the regression suite", description: null, parentObjectiveId: targets[0].id, startDate: null, endDate: null,
    measurement: { method: "ManualPercentage" }, planWeight: 60, expectedVersion: plan.version,
  }, aicha);
  plan = data(r);
  r = await call("POST", `${plans}/plan/objectives`, {
    title: "Ship the release dashboard", description: null, parentObjectiveId: null, startDate: null, endDate: null,
    measurement: { method: "WeightedMilestones", milestones: [
      { title: "Data model", weight: 40 }, { title: "First release", weight: 30 }, { title: "Alerts", weight: 30 }] },
    planWeight: 40, expectedVersion: plan.version,
  }, aicha);
  plan = data(r);
  log("Aicha adds two objectives", r.status === 200 && plan?.objectives.length === 2, `${r.status} ${err(r)}`);
  const manual = plan.objectives.find((o) => o.title.startsWith("Automate"));
  const milestones = plan.objectives.find((o) => o.title.startsWith("Ship"));
  r = await call("POST", `${plans}/plan/submit`, { expectedVersion: plan.version }, aicha);
  log("Aicha submits", r.status === 200 && data(r)?.state === "Submitted", `${r.status} ${err(r)}`);

  // 2. Mariam returns it with two change requests.
  plan = data(await call("GET", `${plans}/plans/${plan.id}`, null, mariam));
  r = await call("POST", `${plans}/plans/${plan.id}/return`, {
    feedback: null, expectedVersion: plan.version,
    changeRequests: [
      { objectiveId: manual.id, text: "Say which suites, and by when." },
      { objectiveId: milestones.id, text: "Add a milestone for the handover." },
    ],
  }, mariam);
  plan = data(r);
  const returned = plan?.history.at(-1);
  log("Mariam returns with two change requests", r.status === 200 && plan.state === "Draft" && returned?.changeRequests.length === 2,
    `${r.status} ${err(r)}`);

  // 3. Aicha addresses one; resubmitting is refused.
  const [first, second] = returned.changeRequests;
  r = await call("POST", `${plans}/plan/change-requests/${first.id}/address`, { reply: "Named the three suites.", expectedVersion: plan.version }, aicha);
  plan = data(r);
  log("Aicha addresses the first request with a reply", r.status === 200 && plan.readiness.openChangeRequests === 1, `${r.status} ${err(r)}`);
  r = await call("POST", `${plans}/plan/submit`, { expectedVersion: plan.version }, aicha);
  log("Resubmitting with a request open is refused", r.status >= 400 && err(r).includes("NotSubmittable"), `${r.status} ${err(r)}`);

  // 4. She addresses the other, resubmits; Mariam sees the outcomes and approves.
  r = await call("POST", `${plans}/plan/change-requests/${second.id}/address`, { reply: null, expectedVersion: plan.version }, aicha);
  plan = data(r);
  r = await call("POST", `${plans}/plan/submit`, { expectedVersion: plan.version }, aicha);
  log("Aicha resubmits once both are addressed", r.status === 200 && data(r)?.state === "Submitted", `${r.status} ${err(r)}`);
  plan = data(await call("GET", `${plans}/plans/${plan.id}`, null, mariam));
  const outcomes = [...plan.history].reverse().find((h) => h.kind === "Returned")?.changeRequests ?? [];
  log("Mariam sees each request addressed", outcomes.every((c) => c.state === "Addressed"), outcomes.map((c) => `${c.state}/${c.objectiveChanged}`).join(", "));
  r = await call("POST", `${plans}/plans/${plan.id}/approve`, { expectedVersion: plan.version }, mariam);
  plan = data(r);
  log("Mariam approves", r.status === 200 && plan?.state === "Approved" && plan.canRequestUpdate, `${r.status} ${err(r)}`);

  // 5. Mariam asks for an update on the milestone objective.
  r = await call("POST", `${plans}/plans/${plan.id}/update-requests`, { objectiveId: milestones.id, note: "Where is the dashboard at?" }, mariam);
  log("Mariam requests an update on one objective", r.status === 200 && data(r)?.state === "Open", `${r.status} ${err(r)}`);
  r = await call("GET", "/api/performance/work", null, aicha);
  const askItem = data(r)?.find((i) => i.kind === "update-request");
  log("Aicha's work item opens the objective in record mode", askItem?.href?.endsWith(`/objectives/${milestones.id}?mode=record`), askItem?.href);

  // 6. Aicha records a two-milestone check-in at risk; the request is answered and Mariam is told.
  const progress = data(await call("GET", `${plans}/objectives/${milestones.id}/progress`, null, aicha));
  // By title, not API order: "Data model" (40) and "First release" (30) make the expected 70% (B-091).
  const [m1, m2] = ["Data model", "First release"].map((title) => progress.milestones.find((m) => m.title === title));
  r = await call("POST", `${plans}/objectives/${milestones.id}/progress`, {
    expectedVersion: progress.version, milestones: [{ milestoneId: m1.id, completed: true }, { milestoneId: m2.id, completed: true }],
    status: "AtRisk", contextNote: "Alerts depend on the monitoring upgrade, now slipping to December.", isCorrection: false, evidence: [],
  }, aicha);
  const recorded = data(r);
  log("Aicha records one check-in with two milestones, at risk", r.status === 200 && recorded.derivedProgress === 70
    && recorded.history[0].milestoneChanges.length === 2 && recorded.history[0].status === "AtRisk", `${r.status} ${err(r)}`);
  r = await call("GET", `${plans}/plans/${plan.id}/update-requests`, null, mariam);
  log("The request is answered", data(r)?.[0]?.state === "Satisfied", data(r)?.[0]?.state);
  r = await call("GET", "/api/performance/notifications", null, mariam);
  const told = data(r)?.items ?? [];
  log("Mariam is notified the update came in", told.some((n) => n.kind === "UpdateRequestAnswered"), told.map((n) => n.kind).slice(0, 4).join(", "));
  log("Mariam is notified the objective went at risk", told.some((n) => n.kind === "ObjectiveAtRisk" && n.title === "Aicha Bouazizi's objective is at risk"));

  // 7. The attention item stays until Mariam acknowledges.
  r = await call("GET", "/api/performance/work", null, mariam);
  log("Mariam's work list has the attention item", data(r)?.some((i) => i.kind === "objective-status" && i.href.endsWith(milestones.id)));
  let goal = data(await call("GET", `${plans}/goals/${milestones.id}`, null, mariam));
  log("Mariam reads the status and reason", goal?.status?.value === "AtRisk" && goal.status.reason?.startsWith("Alerts") && goal.canAcknowledgeStatus);
  r = await call("POST", `${plans}/objectives/${milestones.id}/status/acknowledge`, { expectedVersion: goal.node.version }, mariam);
  log("Mariam acknowledges", r.status === 200 && data(r)?.status?.acknowledgedAt, `${r.status} ${err(r)}`);
  r = await call("GET", "/api/performance/work", null, mariam);
  log("The attention item is gone", !data(r)?.some((i) => i.kind === "objective-status" && i.href.endsWith(milestones.id)));
  goal = data(await call("GET", `${plans}/goals/${milestones.id}`, null, aicha));
  log("Aicha sees who acknowledged", goal?.status?.acknowledgedBy?.id === MARIAM, goal?.status?.acknowledgedBy?.name);

  // 8. Development: each adds a goal; the other is told.
  const dev = `${plans}/people/${AICHA}/development`;
  let development = data(await call("GET", dev, null, aicha));
  const competency = development.competencyOptions[0];
  r = await call("POST", `${dev}/goals`, {
    expectedVersion: development.version, title: "Lead a test-strategy review", competencyId: competency?.id ?? null,
    actions: ["Pick a product area", "Present to the QA guild"], targetDate: "2027-03-31", status: "InProgress",
  }, aicha);
  development = data(r);
  log("Aicha adds a development goal", r.status === 200 && development.goals.length === 1, `${r.status} ${err(r)}`);
  r = await call("POST", `${dev}/goals`, {
    expectedVersion: development.version, title: "Mentor a new joiner", competencyId: null, actions: [], targetDate: null, status: "NotStarted",
  }, mariam);
  log("Mariam adds one too", r.status === 200 && data(r)?.goals.length === 2, `${r.status} ${err(r)}`);
  const mariamTold = (data(await call("GET", "/api/performance/notifications", null, mariam))?.items ?? []).some((n) => n.kind === "DevelopmentGoalAdded");
  const aichaTold = (data(await call("GET", "/api/performance/notifications", null, aicha))?.items ?? []).some((n) => n.kind === "DevelopmentGoalAdded");
  log("Each is told about the other's goal", mariamTold && aichaTold, `Mariam ${mariamTold}, Aicha ${aichaTold}`);

  // 9. The person summary shows status and development.
  r = await call("GET", `/api/performance/people/${AICHA}/summary`, null, mariam);
  const summary = data(r);
  const statuses = summary?.currentCycle?.objectives.map((o) => o.status);
  log("Mariam's summary of Aicha shows status and development", statuses?.includes("AtRisk") && summary?.development?.goals.length === 2,
    `${statuses?.join(", ")}; ${summary?.development?.goals.length} goals`);
  r = await call("GET", `/api/performance/people/${AICHA}/summary`, null, await login("rim.mahjoub@example.test"));
  log("A colleague's summary carries no development", data(r)?.development === null, data(r)?.relation);

  console.log(failed === 0 ? "\nAll steps passed." : `\n${failed} step(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
