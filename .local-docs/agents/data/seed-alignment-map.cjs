// Slice 2b demo data for the alignment map, through the product API (run after prepare-carthage-demo.mjs and the
// slice 2a journeys). Gives FY2027 a real company → team → personal tree with owner-reported statuses:
//   - four published team objectives under the company objectives, each owned by a persona in that team;
//   - check-ins on three of them (on track, off track, at risk) by their owners; one stays not reported;
//   - Rim Mahjoub and Khaled Sassi write and submit plans aligned to team objectives (counted, not reported yet);
//   - Mariam Gharbi and Omar Mansour check in on their approved personal objectives (on track, at risk).
// Leila Baccouche's Draft plan is left alone: it is the employee composer for the AI coach.
// Idempotent: existing objectives (by title), plans and check-ins are reused.
//   node .local-docs/agents/data/seed-alignment-map.cjs
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const base = `/api/performance/cycles/${CYCLE}`;
const data = (r) => r.json?.data;
let failed = 0;
const step = (label, r, ok = r.status < 300) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (${r.status}${ok ? "" : ` ${r.json?.details?.code ?? ""} ${r.json?.errors?.[0] ?? ""}`})`);
  return data(r);
};

const TEAM_OBJECTIVES = [
  {
    owner: "mariam.gharbi", parent: "Build a resilient, secure cloud platform",
    title: "Cut production incidents by 40%",
    measurement: { method: "NumericTarget", baseline: 25, target: 15, unit: "incidents a quarter", direction: "Decrease" },
    checkIn: { numericActual: 21, status: "OnTrack", contextNote: null },
  },
  {
    owner: "omar.mansour", parent: "Build a resilient, secure cloud platform",
    title: "Move every service to zero-downtime deploys",
    measurement: { method: "ManualPercentage" },
    checkIn: { percentage: 20, status: "OffTrack", contextNote: "The load balancer migration slipped to Q2; three services still deploy with downtime." },
  },
  {
    owner: "aicha.bouazizi", parent: "Improve customer delivery predictability",
    title: "Make delivery dates clients can trust",
    measurement: { method: "NumericTarget", baseline: 62, target: 90, unit: "% on time", direction: "Increase" },
    checkIn: { numericActual: 70, status: "AtRisk", contextNote: "Two client releases moved; estimation reviews start next sprint." },
  },
  {
    owner: "leila.baccouche", parent: "Grow sustainable Tunisian digital capabilities",
    title: "Grow the Product B talent bench",
    measurement: { method: "ManualPercentage" },
    checkIn: null,
  },
];

const PERSONAL_PLANS = [
  { who: "rim.mahjoub", team: "Cut production incidents by 40%", title: "Automate the incident runbooks" },
  { who: "khaled.sassi", team: "Grow the Product B talent bench", title: "Mentor two new platform engineers" },
];

const APPROVED_CHECK_INS = [
  { who: "mariam.gharbi", status: "OnTrack", note: null, percent: 40 },
  { who: "omar.mansour", status: "AtRisk", note: "Waiting on the security review before the second release.", percent: 25 },
];

async function checkIn(token, objectiveId, input, label) {
  const progress = data(await call("GET", `${base}/objectives/${objectiveId}/progress`, null, token));
  if (progress?.history?.some((entry) => entry.status)) return console.log(`SKIP  ${label} (already reported)`);
  step(label, await call("POST", `${base}/objectives/${objectiveId}/progress`, {
    expectedVersion: progress.version, percentage: input.percentage ?? null, numericActual: input.numericActual ?? null,
    milestones: input.milestones ?? null, status: input.status, contextNote: input.contextNote ?? null, isCorrection: false, evidence: [],
  }, token));
}

/** A progress input that fits the objective's own measure, at roughly `percent` complete. */
function progressFor(objective, percent, status, note) {
  const m = objective.measurement;
  if (m?.method === "NumericTarget") return { numericActual: m.baseline + ((m.target - m.baseline) * percent) / 100, status, contextNote: note };
  if (m?.method === "WeightedMilestones") return { milestones: [{ milestoneId: m.milestones[0].id, completed: true }], status, contextNote: note };
  return { percentage: percent, status, contextNote: note };
}

(async () => {
  const tokens = {};
  const token = async (who) => (tokens[who] ??= await login(`${who}@example.test`));
  const amira = await token("amira.khelifi");

  let overview = data(await call("GET", `${base}/goals`, null, amira));
  const byTitle = (title) => overview.nodes.find((node) => node.title === title);

  // 1. Team objectives, created and published by the administrator for the owner's team.
  for (const spec of TEAM_OBJECTIVES) {
    const owner = await token(spec.owner);
    const me = data(await call("GET", "/api/corehr/workforce/me", null, owner));
    const ownerId = me.employee.employeeId ?? me.employee.id;
    let node = byTitle(spec.title);
    if (!node) {
      const cycleVersion = data(await call("GET", base, null, amira)).cycle.version;
      const created = step(`Create "${spec.title}" for ${me.employee.orgUnit.name}`, await call("POST", `${base}/goals`, {
        orgUnitId: me.employee.orgUnit.orgUnitId, orgUnitName: me.employee.orgUnit.name, title: spec.title, description: null,
        accountablePersonId: ownerId, parentObjectiveId: byTitle(spec.parent).id, startDate: null, endDate: null,
        progressSource: "Direct", measurement: spec.measurement, expectedVersion: cycleVersion,
      }, amira));
      node = created?.node;
    }
    if (node && node.state !== "Published")
      step(`Publish "${spec.title}"`, await call("POST", `${base}/goals/${node.id}/publish`, { expectedVersion: node.version }, amira));
    overview = data(await call("GET", `${base}/goals`, null, amira));
    if (spec.checkIn) await checkIn(owner, byTitle(spec.title).id, spec.checkIn, `${spec.owner} checks in on "${spec.title}" (${spec.checkIn.status})`);
  }

  // 2. Personal plans aligned to team objectives, submitted for review.
  for (const spec of PERSONAL_PLANS) {
    const who = await token(spec.who);
    let state = data(await call("GET", `${base}/plan`, null, who));
    if (state?.plan && state.plan.state !== "Draft") { console.log(`SKIP  ${spec.who}'s plan (already ${state.plan.state})`); continue; }
    let plan = state?.plan;
    if (!plan) {
      const cycleVersion = data(await call("GET", base, null, who)).cycle.version;
      plan = step(`${spec.who} creates a plan`, await call("POST", `${base}/plan`, { expectedVersion: cycleVersion }, who));
    }
    if (!plan.objectives.some((o) => o.title === spec.title))
      plan = step(`${spec.who} aligns "${spec.title}" to "${spec.team}"`, await call("POST", `${base}/plan/objectives`, {
        title: spec.title, description: null, parentObjectiveId: byTitle(spec.team).id, startDate: null, endDate: null,
        measurement: { method: "ManualPercentage" }, planWeight: 100, expectedVersion: plan.version,
      }, who));
    step(`${spec.who} submits`, await call("POST", `${base}/plan/submit`, { expectedVersion: plan.version }, who));
  }

  // 3. Check-ins on approved personal objectives that align to company direction.
  for (const spec of APPROVED_CHECK_INS) {
    const who = await token(spec.who);
    const plan = data(await call("GET", `${base}/plan`, null, who))?.plan;
    const objective = plan?.objectives.find((o) => o.isAligned);
    if (!objective) { console.log(`SKIP  ${spec.who} has no aligned approved objective`); continue; }
    await checkIn(who, objective.id, progressFor(objective, spec.percent, spec.status, spec.note), `${spec.who} checks in on "${objective.title}" (${spec.status})`);
  }

  console.log(failed ? `${failed} step(s) failed` : "Alignment map seeded.");
  process.exitCode = failed ? 1 : 0;
})();
