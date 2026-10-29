// API journey for the add-ai-coach-and-alignment-map change (slice 2b, task 9.2), through the shell's /api with
// the real AI provider (needs GROQ_API_KEY in Performance's environment). Run after seed-alignment-map.cjs.
//   - Leila (employee, Draft plan) sees AI available and asks the plan coach about a vague draft.
//   - Mariam (manager, objective authority) asks the team coach for her team; any parent is one of the team's.
//   - Leila's map has published direction and counts but no one else's personal objective.
//   - Mariam's map shows her report Aicha's personal objective.
//   - Amira switches AI off: Leila's context says unavailable and the coach answers 503; Amira switches it back on.
// Changes data: audit entries for the coach calls; the AI switch ends where it started (on).
//   node .local-docs/agents/data/journey-ai-coach-and-alignment-map.cjs
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const base = `/api/performance/cycles/${CYCLE}`;
const data = (r) => r.json?.data;
let failed = 0;
const log = (step, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? `  (${detail})` : ""}`);
};
const describe = (result) => !result ? "" : result.outcome === "NothingToSuggest" ? "nothing to suggest"
  : [result.title && `title "${result.title}"`, result.measure && `measure ${result.measure.method} target ${result.measure.target ?? "-"} ${result.measure.unit ?? ""}`,
    result.parentObjectiveId && "a parent"].filter(Boolean).join("; ");

(async () => {
  const leila = await login("leila.baccouche@example.test");
  const mariam = await login("mariam.gharbi@example.test");
  const amira = await login("amira.khelifi@example.test");

  // 1. The plan coach for an employee writing a vague objective.
  let r = await call("GET", `/api/performance/context?cycleId=${CYCLE}`, null, leila);
  log("Leila's workspace says AI is available", data(r)?.capabilities?.aiAssistance === true);
  const targets = data(await call("GET", `${base}/plan/alignment-targets`, null, leila)) ?? [];
  const started = Date.now();
  r = await call("POST", `${base}/objective-coach`, {
    surface: "Plan", title: "Improve onboarding", description: "New joiners take too long to become productive.",
    measurement: { method: "ManualPercentage" }, parentObjectiveId: null,
  }, leila);
  const planResult = data(r);
  log("The plan coach answers", r.status === 200 && ["Suggested", "NothingToSuggest"].includes(planResult?.outcome),
    `${r.status} in ${Date.now() - started} ms: ${describe(planResult) || JSON.stringify(r.json).slice(0, 200)}`);
  log("A suggested parent is one Leila may align to",
    !planResult?.parentObjectiveId || targets.some((t) => t.id === planResult.parentObjectiveId));

  // 2. The team coach for a manager's own team.
  const me = data(await call("GET", "/api/corehr/workforce/me", null, mariam));
  const unit = me.employee.orgUnit;
  const workspace = data(await call("GET", `${base}/goals/team-workspace?orgUnitId=${unit.orgUnitId}`, null, mariam));
  r = await call("POST", `${base}/objective-coach`, {
    surface: "Team", orgUnitId: unit.orgUnitId, title: "Better on-call", description: null,
    measurement: { method: "NumericTarget", baseline: null, target: null, unit: null, direction: "Increase" }, parentObjectiveId: null,
  }, mariam);
  const teamResult = data(r);
  log(`The team coach answers for ${unit.name}`, r.status === 200, `${r.status}: ${describe(teamResult) || JSON.stringify(r.json).slice(0, 200)}`);
  log("A suggested parent is one of the team's eligible parents",
    !teamResult?.parentObjectiveId || workspace.alignmentTargets.some((t) => t.id === teamResult.parentObjectiveId));

  // 3. The map, as an employee and as a manager.
  r = await call("GET", `${base}/goals/map`, null, leila);
  let nodes = data(r)?.nodes ?? [];
  const leilaPersonal = nodes.filter((n) => n.kind === "Personal");
  const counted = nodes.reduce((total, n) => total + (n.personal?.total ?? 0), 0);
  log("Leila's map shows published direction and counts", r.status === 200 && nodes.some((n) => n.kind === "OrgUnit") && counted > 0,
    `${nodes.filter((n) => n.kind !== "Personal").length} direction nodes, ${counted} personal counted`);
  log("Leila's map holds no one else's personal objective", leilaPersonal.every((n) => n.isOwn)
    && !JSON.stringify(r.json).includes("Automate the incident runbooks"), `${leilaPersonal.length} personal nodes`);
  r = await call("GET", `${base}/goals/map`, null, mariam);
  nodes = data(r)?.nodes ?? [];
  log("Mariam's map shows her report Aicha's objective", nodes.some((n) => n.kind === "Personal" && n.ownerName === "Aicha Bouazizi"));

  // 4. The tenant switch.
  let settings = data(await call("GET", "/api/performance/settings", null, amira));
  r = await call("PUT", "/api/performance/settings", { ...settings, aiAssistanceEnabled: false, expectedVersion: settings.version }, amira);
  log("Amira switches AI off", r.status === 200 && data(r)?.aiAssistanceEnabled === false, `${r.status}`);
  r = await call("GET", `/api/performance/context?cycleId=${CYCLE}`, null, leila);
  log("Leila's workspace says AI is unavailable", data(r)?.capabilities?.aiAssistance === false);
  r = await call("POST", `${base}/objective-coach`, { surface: "Plan", title: "Improve onboarding" }, leila);
  log("The coach answers unavailable", r.status === 503 && r.json?.details?.code === "Performance.AiUnavailable", `${r.status} ${r.json?.details?.code}`);
  settings = data(await call("GET", "/api/performance/settings", null, amira));
  r = await call("PUT", "/api/performance/settings", { ...settings, aiAssistanceEnabled: true, expectedVersion: settings.version }, amira);
  log("Amira switches AI back on", r.status === 200 && data(r)?.aiAssistanceEnabled === true, `${r.status}`);

  console.log(failed ? `\n${failed} step(s) failed.` : "\nAll steps passed.");
  process.exitCode = failed ? 1 : 0;
})();
