// B-154 demo data: a realistic week in the bell for each of Carthage Digital Group's seven accounts, through the
// product API at the gateway with the Development-only demo clock (X-Demo-Clock), so each notification carries the day
// and hour it happened. Praise, feedback and 1:1 actions between colleagues over the last six days and today; what is
// older than yesterday noon is marked read by its recipient, the rest stays unread.
// Idempotent: creates use stable client ids, so a re-run returns the originals and adds nothing.
//   node .local-docs/agents/data/seed-b154-bell-week.mjs
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PASSWORD } = require("../../../.agents/skills/fusion-dev/scripts/api.cjs");
const BASE = process.env.FUSION_GATEWAY ?? "http://localhost:5000";

const tokens = {};
async function token(who) {
  if (tokens[who]) return tokens[who];
  const r = await fetch(`${BASE}/api/identity/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${who}@example.test`, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`sign-in ${who} → ${r.status}`);
  return (tokens[who] = (await r.json()).data.accessToken);
}

async function send(who, method, route, body, at) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${await token(who)}` };
  if (at && new Date(at).getTime() < Date.now() - 60_000) headers["X-Demo-Clock"] = at;
  const r = await fetch(`${BASE}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json, data: json?.data ?? json };
}

let failed = 0;
function step(label, r) {
  const ok = r.status < 300;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (${r.status}${ok ? "" : ` ${r.json?.details?.code ?? ""} ${r.json?.errors?.[0] ?? ""}`})`);
  return ok ? r.data : null;
}

function id(name) {
  const h = crypto.createHash("md5").update(`carthage-b154-bell-week:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Local time on a day `offset` days from today; today's moments are hours before now. */
function at(offset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

function dateIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const employee = {};
async function me(who) {
  if (!employee[who]) {
    const self = (await send(who, "GET", "/api/corehr/workforce/me")).data.employee;
    employee[who] = self.employeeId ?? self.id;
  }
  return employee[who];
}

const PEOPLE = ["amira.khelifi", "mariam.gharbi", "omar.mansour", "leila.baccouche", "khaled.sassi", "rim.mahjoub", "aicha.bouazizi"];

// What happened, oldest first. value: index into the company values; action: a 1:1 action from a manager.
const WEEK = [
  { key: "p1", at: at(-6, 9, 40), kind: "praise", from: "omar.mansour", to: "leila.baccouche", value: 0, text: "Your release notes answered every client question before it was asked." },
  { key: "f1", at: at(-6, 14, 10), kind: "feedback", from: "mariam.gharbi", to: "aicha.bouazizi", text: "The test plan for the billing release was thorough. Next time, share the risky cases with the client a day earlier." },
  { key: "p2", at: at(-5, 10, 5), kind: "praise", from: "khaled.sassi", to: "rim.mahjoub", value: 1, text: "Thanks for pairing on the flaky pipeline. It has been green all week." },
  { key: "f2", at: at(-5, 16, 30), kind: "feedback", from: "amira.khelifi", to: "omar.mansour", text: "The hiring plan was clear and costed. Add the onboarding load on each team lead." },
  { key: "f3", at: at(-4, 11, 20), kind: "feedback", from: "leila.baccouche", to: "khaled.sassi", text: "Your demo of the new reporting screens was easy to follow. The live data made the difference." },
  { key: "p3", at: at(-4, 15, 45), kind: "praise", from: "rim.mahjoub", to: "amira.khelifi", value: 2, text: "The new leave policy explainer saved my team a dozen questions." },
  { key: "a1", at: at(-3, 9, 15), kind: "action", from: "amira.khelifi", to: "mariam.gharbi", text: "Send the Q1 hiring priorities to HR" },
  { key: "p4", at: at(-3, 13, 0), kind: "praise", from: "aicha.bouazizi", to: "mariam.gharbi", value: 3, text: "Thank you for shielding the team during the release crunch." },
  { key: "a2", at: at(-2, 10, 30), kind: "action", from: "mariam.gharbi", to: "aicha.bouazizi", text: "Prepare the client demo script" },
  { key: "f4", at: at(-2, 17, 5), kind: "feedback", from: "omar.mansour", to: "rim.mahjoub", text: "The incident timeline you wrote was precise. Keep the customer impact section first." },
  { key: "p5", at: at(-1, 9, 50), kind: "praise", from: "leila.baccouche", to: "aicha.bouazizi", value: 4, text: "Stayed late to fix the export before the client call. Thank you." },
  { key: "f5", at: at(-1, 11, 15), kind: "feedback", from: "rim.mahjoub", to: "leila.baccouche", text: "The onboarding checklist is excellent. A short video for the first day would help too." },
  { key: "p6", at: at(-1, 15, 30), kind: "praise", from: "khaled.sassi", to: "omar.mansour", value: 0, text: "The capacity plan made next quarter look possible. Thanks for the late nights." },
  { key: "a3", at: at(-1, 16, 40), kind: "action", from: "amira.khelifi", to: "omar.mansour", text: "Share the zero-downtime deploy checklist" },
  { key: "f6", at: ago(190), kind: "feedback", from: "aicha.bouazizi", to: "khaled.sassi", text: "Your code review comments were kind and specific. I learned a lot from them." },
  { key: "p7", at: ago(120), kind: "praise", from: "mariam.gharbi", to: "rim.mahjoub", value: 1, text: "Your data pipeline fix saved the sprint review." },
  { key: "f7", at: ago(75), kind: "feedback", from: "omar.mansour", to: "amira.khelifi", text: "The town hall answers were direct and honest. People noticed." },
  { key: "p8", at: ago(30), kind: "praise", from: "amira.khelifi", to: "mariam.gharbi", value: 2, text: "Product B launched on the day we promised. Thank you for holding it together." },
];

const values = (await send("amira.khelifi", "GET", "/api/performance/values")).data ?? [];
if (values.length < 3) throw new Error("Carthage needs at least three company values.");
const value = (i) => values[i % values.length].id;

// A manager's 1:1 series with a report, for actions.
async function seriesWith(manager, report) {
  const list = (await send(manager, "GET", "/api/performance/one-on-ones")).data;
  const reportId = await me(report);
  return list?.reports?.find((s) => s.with.employeeId === reportId && !s.ended)?.seriesId ?? null;
}

for (const e of WEEK) {
  const label = `${e.at.slice(0, 16)}  ${e.from} → ${e.to} (${e.kind})`;
  if (e.kind === "praise") {
    step(label, await send(e.from, "POST", "/api/performance/praise",
      { id: id(e.key), recipientEmployeeIds: [await me(e.to)], competencyId: value(e.value), message: e.text }, e.at));
  } else if (e.kind === "feedback") {
    step(label, await send(e.from, "POST", "/api/performance/feedback",
      { id: id(e.key), receiverEmployeeId: await me(e.to), visibility: "Shared", message: e.text }, e.at));
  } else {
    const series = await seriesWith(e.from, e.to);
    if (!series) { console.log(`SKIP  ${label}: no 1:1 between them`); continue; }
    step(label, await send(e.from, "POST", `/api/performance/one-on-ones/${series}/actions`,
      { id: id(e.key), text: e.text, ownerEmployeeId: await me(e.to), dueDate: dateIn(5) }, e.at));
  }
}

// Older than yesterday noon has been read; the rest waits in the bell.
const readBefore = at(-1, 12);
for (const who of PEOPLE) {
  const feed = (await send(who, "GET", "/api/performance/notifications?limit=20")).data;
  const ids = (feed?.items ?? []).filter((n) => !n.readAt && n.occurredAt < readBefore).map((n) => n.id);
  if (ids.length) step(`${who} has read ${ids.length} older`, await send(who, "POST", "/api/performance/notifications/read", { ids }));
  const after = (await send(who, "GET", "/api/performance/notifications?limit=20")).data;
  console.log(`      ${who}: ${after?.items?.length ?? 0} in the bell, ${after?.unreadCount ?? 0} unread`);
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll steps passed");
process.exit(failed ? 1 : 0);
