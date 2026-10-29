// API journey for the establish-fusion-frame change (task 6.1), through the shell's /api.
// Amira approves Omar's submitted Carthage plan; checks that her work item disappears, Omar gets
// an unread in-app notification, marking it read zeroes his count, a colleague's summary has no
// sections, and an unknown employee id gets the empty answer.
// Changes data: Omar's plan (CDG-006) goes from Submitted to Approved.
//   node .local-docs/agents/data/journey-fusion-frame-approve-plan.cjs
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const { CYCLE, employee, plan } = require("./carthage-ids.cjs");
const OMAR_PLAN = plan("CDG-006");
const OMAR = employee("CDG-006");
const LEILA = employee("CDG-021");

const log = (step, ok, detail) => console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? `  (${detail})` : ""}`);
const data = (r) => r.json?.data;

(async () => {
  const amira = await login("amira.khelifi@example.test");
  const omar = await login("omar.mansour@example.test");
  const rim = await login("rim.mahjoub@example.test");
  const decisionId = `performance:plan-decision:${OMAR_PLAN}`;

  let r = await call("GET", "/api/performance/work", null, amira);
  log("GET /api/performance/work (Amira) lists Omar's plan decision", r.status === 200 && data(r).some((i) => i.id === decisionId), `${r.status}`);

  const before = data(await call("GET", "/api/performance/notifications", null, omar));
  r = await call("GET", `/api/performance/cycles/${CYCLE}/plans/${OMAR_PLAN}`, null, amira);
  const plan = data(r);
  if (plan?.state === "Submitted") {
    r = await call("POST", `/api/performance/cycles/${CYCLE}/plans/${OMAR_PLAN}/approve`, { expectedVersion: plan.version }, amira);
    log("POST .../approve (Amira approves Omar's plan)", r.status === 200 && data(r)?.state === "Approved", `${r.status}`);
  } else {
    log("Omar's plan is still Submitted", false, `state ${plan?.state}`);
  }

  r = await call("GET", "/api/performance/work", null, amira);
  log("GET /api/performance/work (Amira) no longer lists it", r.status === 200 && !data(r).some((i) => i.id === decisionId), `${data(r)?.length} items`);

  r = await call("GET", "/api/performance/notifications", null, omar);
  const page = data(r);
  const approved = page?.items.find((n) => n.kind === "PlanApproved" && !n.readAt);
  log("GET /api/performance/notifications (Omar) has an unread approval",
    r.status === 200 && Boolean(approved) && page.unreadCount === (before?.unreadCount ?? 0) + 1,
    `unread ${before?.unreadCount ?? 0} -> ${page?.unreadCount}; "${approved?.title}" -> ${approved?.href}`);

  r = await call("POST", "/api/performance/notifications/read", { all: true }, omar);
  log("POST /api/performance/notifications/read all (Omar) zeroes the count", r.status === 200 && data(r)?.unreadCount === 0, `${r.status} unread ${data(r)?.unreadCount}`);

  r = await call("GET", `/api/performance/people/${LEILA}/summary`, null, rim);
  const colleague = data(r);
  log("GET /api/performance/people/{Leila}/summary (Rim, a colleague) has no sections",
    r.status === 200 && colleague.relation === "Other" && colleague.currentCycle === null && colleague.reviews === null,
    `${r.status} relation ${colleague?.relation}`);

  const unknown = "00000000-0000-4000-8000-000000000001";
  r = await call("GET", `/api/performance/people/${unknown}/summary`, null, amira);
  const empty = data(r);
  log("GET /api/performance/people/{unknown}/summary (Amira, administrator) is the empty answer",
    r.status === 200 && empty.displayName === null && empty.currentCycle === null && empty.reviews === null,
    `${r.status} relation ${empty?.relation}`);

  r = await call("GET", `/api/performance/people/${OMAR}/summary`, null, amira);
  log("GET /api/performance/people/{Omar}/summary (Amira) shows his approved plan",
    r.status === 200 && data(r)?.currentCycle?.planStatus === "Approved", `${r.status} ${data(r)?.relation}`);

  r = await call("GET", "/api/corehr/work", null, amira);
  log("GET /api/corehr/work (Amira) answers", r.status === 200, `${r.status}, ${data(r)?.length} items`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
