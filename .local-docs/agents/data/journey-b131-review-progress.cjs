// B-131 API journey: the org chart's Review progress lens reads /api/performance/reviews/progress under
// Performance's review read rule. Read-only; runs against the Year-end preset (an active round).
// Usage: node .local-docs/agents/data/journey-b131-review-progress.cjs [domain]   (default: the yearend preset's domain)
const path = require("path");
const api = require(path.resolve(__dirname, "../../../.claude/skills/fusion-dev/scripts/api.cjs"));
const tokens = new Map();
const call = async (email, method, url, password) => {
  if (!tokens.has(email)) tokens.set(email, await api.login(email, password));
  const res = await api.call(method, url, undefined, tokens.get(email));
  return { status: res.status, body: res.json };
};
const presets = require("./demo-presets.local.json");
const domain = process.argv[2] ?? (presets.presets ?? presets).yearend.domain;
const as = (name) => `${name}@${domain}`;

let failed = 0;
const check = (label, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`); if (!ok) failed++; };
const people = async (email) => {
  const res = await call(email, "GET", "/api/performance/reviews/progress");
  return { status: res.status, list: res.body?.data?.people ?? [] };
};
const count = (list) => Object.entries(list.reduce((m, p) => ({ ...m, [p.isOverdue ? "Late" : p.state]: (m[p.isOverdue ? "Late" : p.state] ?? 0) + 1 }), {}))
  .map(([k, v]) => `${k} ${v}`).join(", ");

(async () => {
  const hr = await people(as("amira.khelifi"));
  check("HR reads progress", hr.status === 200 && hr.list.length > 10, `${hr.list.length}: ${count(hr.list)}`);
  check("No rating in the shape", hr.list.every((p) => Object.keys(p).sort().join() === "dueDate,employeeKey,isOverdue,state"));
  check("Keys are Core's employee keys", hr.list.every((p) => /^E-[0-9A-F]{32}$/.test(p.employeeKey)));

  const chart = await call(as("amira.khelifi"), "GET", "/api/corehr/org-chart");
  const onChart = new Set((chart.body?.data?.people ?? []).map((p) => p.employeeKey));
  check("Every key is on HR's chart", hr.list.every((p) => onChart.has(p.employeeKey)));

  const manager = await people(as("mariam.gharbi"));
  check("Mariam reads fewer than HR", manager.status === 200 && manager.list.length > 0 && manager.list.length < hr.list.length,
    `${manager.list.length}: ${count(manager.list)}`);
  const employee = await people(as("aicha.bouazizi"));
  check("Aicha reads only her own", employee.status === 200 && employee.list.length === 1, `${employee.list.length}`);

  const platform = await call("admin@ey-hr.com", "GET", "/api/performance/reviews/progress");
  check("Platform admin is refused", platform.status === 401 || platform.status === 403, `${platform.status}`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
