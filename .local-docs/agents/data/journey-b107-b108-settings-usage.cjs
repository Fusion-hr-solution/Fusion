// B-107 + B-108 read-only API journey. Roles in Core HR's Settings list names its last change from Identity's role
// audit (Carthage, where `settings-personas.cjs` created two roles); Performance Settings show where things are used
// (Year-end preset: its rounds launched). Usage: node .local-docs/agents/data/journey-b107-b108-settings-usage.cjs
const path = require("path");
const api = require(path.resolve(__dirname, "../../../.claude/skills/fusion-dev/scripts/api.cjs"));
const presets = require("./demo-presets.local.json");
const yearend = (presets.presets ?? presets).yearend.domain;

const tokens = new Map();
const get = async (email, url) => {
  if (!tokens.has(email)) tokens.set(email, await api.login(email));
  const res = await api.call("GET", url, undefined, tokens.get(email));
  return { status: res.status, data: res.json?.data };
};
let failed = 0;
const check = (label, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`); if (!ok) failed++; };

(async () => {
  const carthage = await get("amira.khelifi@example.test", "/api/corehr/settings/sections");
  const roles = (carthage.data ?? []).find((s) => s.id === "roles");
  check("Carthage Roles names its last change", carthage.status === 200 && Boolean(roles?.lastChange?.at),
    roles?.lastChange ? `${roles.lastChange.actorName} at ${roles.lastChange.at}` : `status ${carthage.status}`);

  const admin = `amira.khelifi@${yearend}`;
  const scale = await get(admin, "/api/performance/settings/rating-scale");
  const versions = scale.data?.versions ?? [];
  check("Rating scale lists its versions with rounds", scale.status === 200 && versions.length > 0 && versions.some((v) => v.usedBy.length > 0),
    versions.map((v) => `v${v.number}: ${v.usedBy.join(", ") || "unused"}`).join(" | "));

  const competencies = await get(admin, "/api/performance/settings/competencies");
  const used = (competencies.data ?? []).filter((c) => c.usedIn.length);
  check("Competencies name their cycles", competencies.status === 200 && used.length > 0,
    used.slice(0, 3).map((c) => `${c.name}: ${c.usedIn.join(", ")}`).join(" | "));

  const questions = await get(admin, "/api/performance/settings/review-questions");
  const asked = (questions.data ?? []).filter((q) => q.roundCount > 0);
  check("Questions count their rounds", questions.status === 200 && asked.length > 0,
    asked.slice(0, 3).map((q) => `${q.roundCount}× ${q.text.slice(0, 30)}`).join(" | "));

  const employee = await get(`aicha.bouazizi@${yearend}`, "/api/performance/settings/rating-scale");
  check("An employee can't read the settings", employee.status === 403, `${employee.status}`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
