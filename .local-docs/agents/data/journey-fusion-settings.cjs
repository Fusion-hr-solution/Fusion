// API journey for the add-fusion-settings change (B-071, tasks 6.2 and 8.1), through the shell's /api.
// - Amira lists the Core HR and Performance sections, saves Reviews, and gets a conflict on a stale version.
// - Aicha (employee) is refused Performance settings and reads the field policy her profile needs (200).
// - Aicha turns off 1:1 email; Mariam assigns her a 1:1 action; the notification is in-app only and the outbox
//   records the skip as RecipientOptedOut.
// Changes data, then puts it back: Reviews' manager-assessment default is changed and restored (two audited
// changes by Amira); Aicha's 1:1 email goes off and back on; Mariam's new action for Aicha is marked done.
//   node .local-docs/agents/data/journey-fusion-settings.cjs
const path = require("path");
const { execFileSync } = require("child_process");
const { randomUUID } = require("crypto");
const repo = path.join(__dirname, "../../..");
const { call, login } = require(path.join(repo, ".agents/skills/fusion-dev/scripts/api.cjs"));

let failed = 0;
const log = (step, ok, detail) => {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? `  (${detail})` : ""}`);
};
const data = (r) => r.json?.data;
const sql = (query) =>
  execFileSync("pwsh", ["-NoProfile", "-File", path.join(repo, ".agents/skills/fusion-dev/scripts/sql.ps1"), "-Database", "performance", query], {
    encoding: "utf8",
  });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const amira = await login("amira.khelifi@example.test");
  const aicha = await login("aicha.bouazizi@example.test");
  const mariam = await login("mariam.gharbi@example.test");

  // ── Amira: both modules' sections, a Reviews save, a stale save ──
  let r = await call("GET", "/api/corehr/settings/sections", null, amira);
  const core = data(r) ?? [];
  log("Amira lists Core HR's sections", r.status === 200 && core.map((s) => s.id).join() === "company,employee-fields,roles,invitations,change-history",
    core.map((s) => `${s.id}:${s.access}`).join(" "));
  r = await call("GET", "/api/performance/settings/sections", null, amira);
  const perf = data(r) ?? [];
  log("Amira lists Performance's seven sections to manage", r.status === 200 && perf.length === 7 && perf.every((s) => s.access === "manage"),
    perf.map((s) => s.id).join(" "));

  const settings = data(await call("GET", "/api/performance/settings", null, amira));
  const original = settings.managerAssessmentDueDays;
  const { nineBoxBands: _bands, version, ...values } = settings;
  r = await call("PUT", "/api/performance/settings", { ...values, managerAssessmentDueDays: original === 10 ? 9 : 10, expectedVersion: version }, amira);
  const saved = data(r);
  log("Amira saves Reviews (manager assessment default)", r.status === 200 && saved?.managerAssessmentDueDays !== original, `${original} -> ${saved?.managerAssessmentDueDays}`);
  r = await call("PUT", "/api/performance/settings", { ...values, managerAssessmentDueDays: original, expectedVersion: version }, amira);
  log("A save from the version read before is refused as a conflict", r.status === 409, `${r.status}`);
  r = await call("GET", "/api/performance/settings/sections", null, amira);
  const reviews = (data(r) ?? []).find((s) => s.id === "reviews");
  log("Reviews names Amira as its last change", reviews?.lastChange?.actorName === "Amira Khelifi", reviews?.lastChange?.actorName);
  r = await call("PUT", "/api/performance/settings", { ...values, managerAssessmentDueDays: original, expectedVersion: saved.version }, amira);
  log("Amira restores the default", r.status === 200 && data(r)?.managerAssessmentDueDays === original, `${data(r)?.managerAssessmentDueDays}`);

  // ── Aicha: no company settings, but the field policy her profile reads ──
  r = await call("GET", "/api/performance/settings", null, aicha);
  log("Aicha is refused Performance settings", r.status === 403, `${r.status}`);
  r = await call("GET", "/api/performance/settings/rating-scale", null, aicha);
  log("Aicha is refused the rating scale", r.status === 403, `${r.status}`);
  r = await call("GET", "/api/performance/settings/sections", null, aicha);
  log("Aicha has no Performance sections", r.status === 200 && (data(r) ?? []).length === 0, `${(data(r) ?? []).length}`);
  r = await call("GET", "/api/corehr/settings/sections", null, aicha);
  log("Aicha has no Core HR sections", r.status === 200 && (data(r) ?? []).length === 0, `${(data(r) ?? []).length}`);
  r = await call("GET", "/api/corehr/settings/field-visibility", null, aicha);
  const policy = data(r);
  log("Aicha reads the field policy (My Profile)", r.status === 200 && policy?.fields?.phone && policy?.selfService && Object.keys(policy).length === 2,
    `${r.status} ${Object.keys(policy ?? {}).join(",")}`);
  r = await call("GET", "/api/corehr/me/card", null, aicha);
  log("Aicha's own card loads (My Profile)", r.status === 200, `${r.status}`);

  // ── Aicha turns off 1:1 email; the next 1:1 notification is in-app only ──
  let prefs = data(await call("GET", "/api/performance/notification-preferences", null, aicha));
  r = await call("PUT", "/api/performance/notification-preferences", { expectedVersion: prefs.version, emailOff: ["one-on-ones"] }, aicha);
  prefs = data(r);
  log("Aicha turns off 1:1 email", r.status === 200 && prefs.groups.find((g) => g.key === "one-on-ones")?.email === false, `${r.status}`);

  const list = data(await call("GET", "/api/performance/one-on-ones", null, mariam));
  const series = list.reports.find((s) => s.with.displayName === "Aicha Bouazizi");
  const aichaId = series?.with.employeeId;
  const actionId = randomUUID();
  r = await call("POST", `/api/performance/one-on-ones/${series.seriesId}/actions`,
    { id: actionId, text: "Share the test plan for the release candidate", ownerEmployeeId: aichaId, dueDate: null }, mariam);
  log("Mariam assigns Aicha a 1:1 action", r.status === 200, `${r.status}`);

  r = await call("GET", "/api/performance/notifications", null, aicha);
  const inApp = (data(r)?.items ?? []).find((n) => n.kind === "OneOnOneActionAssigned" && n.context?.includes("Share the test plan"));
  log("Aicha has the in-app notification", Boolean(inApp), inApp?.title);

  let row = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const csv = sql(`select "SkippedReason", "DispatchedAt" from performance."PerformanceOutboxMessages"
      where "Kind" = 'OneOnOneActionAssigned' and "RecipientEmployeeId" = '${aichaId}' and "DedupeKey" like '%${actionId.replace(/-/g, "")}%'`);
    // psql's table: the header, a rule, then one row with the skip reason and the dispatch time.
    row = csv.split(/\r?\n/).find((line) => line.includes("|") && !line.includes("SkippedReason") && !line.trim().startsWith("-"))?.trim() ?? "";
    if (/^[A-Za-z]/.test(row)) break;
    await sleep(2000);
  }
  log("The outbox records the email as skipped: RecipientOptedOut", row.startsWith("RecipientOptedOut"), row || "no row");

  // ── Put things back ──
  prefs = data(await call("GET", "/api/performance/notification-preferences", null, aicha));
  r = await call("PUT", "/api/performance/notification-preferences", { expectedVersion: prefs.version, emailOff: [] }, aicha);
  log("Aicha turns 1:1 email back on", r.status === 200, `${r.status}`);
  r = await call("PUT", `/api/performance/one-on-ones/${series.seriesId}/actions/${actionId}/done`, { done: true }, aicha);
  log("The action is marked done", r.status === 200, `${r.status}`);

  console.log(failed === 0 ? "\nAll steps passed." : `\n${failed} step(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
