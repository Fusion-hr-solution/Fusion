// Slice 3 demo data: 1:1s, feedback, a feedback request and praise on Carthage, through the product API (run after
// prepare-carthage-demo.mjs, the slice 2a journey and seed-alignment-map.cjs). Everything is dated today: the API
// records real time, and past-dated history waits for slice 7's Development-only seeder (D-40).
//   - Mariam Gharbi ↔ Aicha Bouazizi, every two weeks: one meeting held today (agenda with Aicha's at-risk objective,
//     shared and private notes, two actions, one carried), the next in two weeks with a new item.
//   - Amira Khelifi ↔ Mariam Gharbi, weekly, first meeting tomorrow; Amira ↔ Omar Mansour, monthly.
//     Amira is HR, so this also shows she can't see Mariam ↔ Aicha.
//   - Feedback: Leila → Rim (shared, a value), Khaled → Aicha (manager only, to Mariam), Mariam → Aicha (about her objective).
//   - A request: Leila asks Rim, Khaled and Aicha; Rim answers, Khaled declines, Aicha keeps the work item.
//   - Five praise across personas and values, with reactions.
// Idempotent: creates use stable client ids, so a second run returns the originals and changes nothing.
//   node .local-docs/agents/data/seed-conversations.cjs
const path = require("path");
const crypto = require("crypto");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const data = (r) => r.json?.data;
let failed = 0;
const step = (label, r, ok = r.status < 300) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (${r.status}${ok ? "" : ` ${r.json?.details?.code ?? ""} ${r.json?.errors?.[0] ?? ""}`})`);
  return data(r);
};

/** A stable id per seeded thing, so re-runs send the same client ids. */
function id(name) {
  const h = crypto.createHash("md5").update(`carthage-conversations:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Today (or a few days on) at a local time, as an instant. */
function at(daysFromToday, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const tokens = {};
  const token = async (who) => (tokens[who] ??= await login(`${who}@example.test`));
  const employee = {};
  const me = async (who) => {
    if (!employee[who]) {
      const self = data(await call("GET", "/api/corehr/workforce/me", null, await token(who))).employee;
      employee[who] = self.employeeId ?? self.id;
    }
    return employee[who];
  };

  const values = data(await call("GET", "/api/performance/values", null, await token("amira.khelifi"))) ?? [];
  if (values.length < 3) throw new Error("Carthage needs at least three active competencies for praise values.");
  const value = (i) => values[i % values.length].id;
  console.log(`Values: ${values.map((v) => v.name).join(", ")}`);

  // ── 1:1s ───────────────────────────────────────────────────────────────────
  async function series(starter, other, cadence, firstAt, label) {
    const started = await call("POST", "/api/performance/one-on-ones",
      { withEmployeeId: await me(other), cadence, firstMeetingAt: firstAt }, await token(starter));
    if (started.status === 409 && started.json?.details?.code === "OneOnOne.AlreadyActive") {
      console.log(`SKIP  ${label} (already started)`);
      return data(await call("GET", `/api/performance/one-on-ones/${started.json.details.extra.seriesId}`, null, await token(starter)));
    }
    return step(label, started);
  }

  const mariamAicha = await series("mariam.gharbi", "aicha.bouazizi", "EveryTwoWeeks", at(0, 9), "Mariam starts 1:1s with Aicha");
  if (mariamAicha && mariamAicha.past.length === 0) {
    const meetingId = mariamAicha.upcoming.id;
    const m = `/api/performance/one-on-ones/meetings/${meetingId}`;
    const mariam = await token("mariam.gharbi");
    const aicha = await token("aicha.bouazizi");
    step("Aicha adds an agenda item", await call("POST", `${m}/agenda`, { id: id("agenda-estimates"), text: "Estimation reviews for client releases" }, aicha));
    const suggestion = mariamAicha.upcoming.suggestions.find((s) => s.kind === "Objective") ?? mariamAicha.upcoming.suggestions[0];
    if (suggestion)
      step(`Mariam adds the suggestion "${suggestion.label}"`, await call("POST", `${m}/agenda`,
        { id: id("agenda-suggestion"), sourceKind: suggestion.kind, sourceId: suggestion.sourceId }, mariam));
    else console.log("NOTE  no suggestion offered for Aicha (no at-risk objective or recent feedback)");
    step("Mariam writes the shared notes", await call("PUT", `${m}/notes/shared`, {
      text: "Agreed to re-estimate the two client releases together on Thursday. Aicha will bring the test automation numbers.",
      expectedRevision: 0,
    }, mariam));
    step("Mariam writes a private note", await call("PUT", `${m}/notes/private`,
      { text: "Check in on workload: Aicha covered two releases this month.", expectedRevision: 0 }, mariam));
    step("Aicha writes a private note", await call("PUT", `${m}/notes/private`,
      { text: "Ask about the test automation training budget.", expectedRevision: 0 }, aicha));
    const s = `/api/performance/one-on-ones/${mariamAicha.id}`;
    step("Mariam gives Aicha an action due in two days", await call("POST", `${s}/actions`, {
      id: id("action-estimate"), text: "Share the revised release estimate with the client", ownerEmployeeId: await me("aicha.bouazizi"), dueDate: dateIn(2),
    }, mariam));
    const withActions = step("Mariam takes an action", await call("POST", `${s}/actions`, {
      id: id("action-roadmap"), text: "Ask the client lead for the Q1 roadmap", ownerEmployeeId: await me("mariam.gharbi"), dueDate: null,
    }, mariam));
    const completed = step("Mariam completes today's meeting", await call("POST", `${m}/complete`,
      { expectedVersion: withActions.upcoming.version }, mariam));
    if (completed?.upcoming)
      step("Aicha adds to the next meeting", await call("POST", `/api/performance/one-on-ones/meetings/${completed.upcoming.id}/agenda`,
        { id: id("agenda-training"), text: "Training budget for test automation" }, aicha));
  } else if (mariamAicha) {
    console.log("SKIP  Mariam ↔ Aicha meeting (already held)");
  }

  const amiraMariam = await series("mariam.gharbi", "amira.khelifi", "Weekly", at(1, 10), "Mariam starts weekly 1:1s with Amira");
  if (amiraMariam?.upcoming && amiraMariam.upcoming.agenda.length === 0)
    step("Mariam adds to her next 1:1 with Amira", await call("POST", `/api/performance/one-on-ones/meetings/${amiraMariam.upcoming.id}/agenda`,
      { id: id("agenda-hiring"), text: "Hiring plan for the platform team" }, await token("mariam.gharbi")));
  await series("amira.khelifi", "omar.mansour", "Monthly", at(3, 14), "Amira starts monthly 1:1s with Omar");

  // ── Feedback ────────────────────────────────────────────────────────────────
  step("Leila gives Rim shared feedback about a value", await call("POST", "/api/performance/feedback", {
    id: id("feedback-leila-rim"), receiverEmployeeId: await me("rim.mahjoub"), visibility: "Shared", competencyId: value(0),
    message: "Your incident write-up for the payments outage was clear and blameless. The on-call team now uses it as the template.",
  }, await token("leila.baccouche")));
  step("Khaled gives Aicha manager-only feedback", await call("POST", "/api/performance/feedback", {
    id: id("feedback-khaled-aicha"), receiverEmployeeId: await me("aicha.bouazizi"), visibility: "ManagerOnly",
    message: "Aicha has been carrying the regression suite for two teams. She could use help before the next release train.",
  }, await token("khaled.sassi")));
  const aichaPlan = data(await call("GET", `/api/performance/cycles/${CYCLE}/plan`, null, await token("aicha.bouazizi")));
  const aichaObjective = aichaPlan?.plan?.objectives?.[0];
  if (aichaObjective)
    step(`Mariam gives Aicha feedback about "${aichaObjective.title}"`, await call("POST", "/api/performance/feedback", {
      id: id("feedback-mariam-aicha"), receiverEmployeeId: await me("aicha.bouazizi"), visibility: "Shared",
      cycleId: CYCLE, objectiveId: aichaObjective.id,
      message: "The milestone breakdown made the risk visible early. Keep flagging blockers this way.",
    }, await token("mariam.gharbi")));
  else console.log("NOTE  Aicha has no plan objective to give feedback about");

  // ── A feedback request ──────────────────────────────────────────────────────
  const request = step("Leila asks Rim, Khaled and Aicha for feedback", await call("POST", "/api/performance/feedback/requests", {
    id: id("request-leila"), question: "How did the Product B onboarding sessions land for your team?",
    inviteeEmployeeIds: [await me("rim.mahjoub"), await me("khaled.sassi"), await me("aicha.bouazizi")], dueDate: dateIn(10), competencyId: value(1),
  }, await token("leila.baccouche")));
  if (request) {
    step("Rim answers", await call("POST", `/api/performance/feedback/requests/${request.id}/answer`, {
      feedbackId: id("answer-rim"), message: "The sessions were practical. The pairing hour helped most; the slides could be shorter.",
    }, await token("rim.mahjoub")));
    step("Khaled declines", await call("POST", `/api/performance/feedback/requests/${request.id}/decline`,
      { reason: "I joined after the sessions ran." }, await token("khaled.sassi")));
  }

  // ── Praise ──────────────────────────────────────────────────────────────────
  const PRAISE = [
    { key: "mariam-aicha", from: "mariam.gharbi", to: ["aicha.bouazizi"], value: 2,
      message: "You kept two client releases on track while covering regression for another team. Calm, careful and on time." },
    { key: "omar-mariam-khaled", from: "omar.mansour", to: ["mariam.gharbi", "khaled.sassi"], value: 0,
      message: "The joint incident drill was the best we have run. Clear roles, and every follow-up has an owner." },
    { key: "rim-leila", from: "rim.mahjoub", to: ["leila.baccouche"], value: 1,
      message: "Thank you for running the onboarding sessions. New joiners are shipping in their first week." },
    { key: "amira-omar", from: "amira.khelifi", to: ["omar.mansour"], value: 3,
      message: "Moving three services to zero-downtime deploys in a month is real progress. Thank you for pushing it through." },
    { key: "aicha-rim", from: "aicha.bouazizi", to: ["rim.mahjoub"], value: 4,
      message: "Your data pipeline fix saved the client demo. Quick, quiet and thorough." },
  ];
  const praiseIds = [];
  for (const p of PRAISE) {
    const given = step(`${p.from} praises ${p.to.join(" and ")}`, await call("POST", "/api/performance/praise", {
      id: id(`praise-${p.key}`), recipientEmployeeIds: await Promise.all(p.to.map(me)), competencyId: value(p.value), message: p.message,
    }, await token(p.from)));
    if (given) praiseIds.push(given.id);
  }
  const REACTIONS = [
    ["omar.mansour", 0, "Celebrate"], ["khaled.sassi", 0, "Applause"], ["amira.khelifi", 0, "ThankYou"],
    ["aicha.bouazizi", 1, "Applause"], ["rim.mahjoub", 1, "Insightful"], ["leila.baccouche", 3, "Celebrate"],
    ["mariam.gharbi", 3, "Applause"], ["khaled.sassi", 4, "ThankYou"],
  ];
  for (const [who, index, kind] of REACTIONS)
    if (praiseIds[index]) step(`${who} reacts ${kind}`, await call("PUT", `/api/performance/praise/${praiseIds[index]}/reactions/${kind}`, {}, await token(who)));

  console.log(failed === 0 ? "\nAll steps passed." : `\n${failed} step(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
