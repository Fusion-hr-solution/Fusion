#!/usr/bin/env node
/**
 * B-132: org chart windows and search (`GET /api/corehr/org-chart?root&depth`, `GET …/org-chart/search?q`), read-only.
 * Carthage has 100 people, under the 3,000 limit, so the whole chart has no window; a root asks for one: the root's
 * chain to the top and its branch to a depth, everyone else folded into loadable counts that add up to the company.
 * Bounds and refusals: depth 1–6, unknown or other-tenant roots 404, another date than today HR only, no org chart
 * role 403, no session 401. Search matches what the viewer sees, in their tenant only.
 * Usage: node .local-docs/agents/data/journey-b132-org-chart-windows.cjs
 */
const { call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");
const presets = require("./demo-presets.local.json");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`); };
const get = async (email, path) => {
  const r = await call("GET", `/api/corehr/org-chart${path}`, null, email ? await login(email) : undefined);
  return { status: r.status, data: r.json?.data };
};

(async () => {
  const whole = await get("aicha.bouazizi@example.test", "");
  check("Up to 3,000 people the whole chart comes back, no window", whole.status === 200 && whole.data.window === null && whole.data.people.length === 100);
  const byName = (name) => whole.data.people.find((p) => p.displayName === name);
  const mariam = byName("Mariam Gharbi");

  const branch = await get("amira.khelifi@example.test", `?root=${mariam.employeeKey}&depth=1`);
  const keys = new Set(branch.data?.people.map((p) => p.employeeKey));
  check("A root brings its branch to the depth", branch.status === 200 && branch.data.people.filter((p) => p.managerKey === mariam.employeeKey).length === mariam.directCount,
    `${branch.data?.people.length} people`);
  check("Everyone in the window has their chain", branch.data.people.every((p) => p.managerKey === null || keys.has(p.managerKey)) && keys.has(byName("Sami Ben Youssef").employeeKey));
  const folded = branch.data.folded.reduce((sum, f) => sum + f.count, 0);
  check("Folded counts account for everyone else, all loadable", branch.data.people.length + folded === 100 && branch.data.folded.every((f) => f.loadable), `${branch.data.people.length} + ${folded}`);
  check("The window speaks for the whole chart", branch.data.window?.headcount === 100 && branch.data.window.divisions.length === 3 && branch.data.window.depth === 1 && /^\d{4}-/.test(branch.data.window.firstStartDate ?? ""),
    JSON.stringify({ ...branch.data.window, divisions: branch.data.window?.divisions.length }));

  const asEmployee = await get("aicha.bouazizi@example.test", `?root=${mariam.employeeKey}`);
  check("An employee opens a branch too, without the first start date", asEmployee.status === 200 && asEmployee.data.window.firstStartDate === null && asEmployee.data.window.depth === 3);
  check("Another date is still HR only", (await get("aicha.bouazizi@example.test", `?root=${mariam.employeeKey}&asOf=2026-12-01`)).status === 403);
  check("Depth 0 and 7 are refused", (await get("amira.khelifi@example.test", `?root=${mariam.employeeKey}&depth=0`)).status === 400
    && (await get("amira.khelifi@example.test", `?root=${mariam.employeeKey}&depth=7`)).status === 400);
  check("An unknown root is not found", (await get("amira.khelifi@example.test", "?root=E-NOPE")).status === 404);
  const preset = presets.presets.planning;
  const elsewhere = await get(`aicha.bouazizi@${preset.domain}`, "");
  const theirs = elsewhere.data?.people[0]?.employeeKey;
  check("Another tenant's person is not found here", theirs && (await get("amira.khelifi@example.test", `?root=${theirs}`)).status === 404);

  const search = async (email, q, extra = "") => get(email, `/search?q=${encodeURIComponent(q)}${extra}`);
  const found = await search("aicha.bouazizi@example.test", "mariam");
  check("Search finds by name, name matches first", found.status === 200 && found.data[0]?.displayName === "Mariam Gharbi", found.data?.map((p) => p.displayName).join(", "));
  check("Search returns eight at most", (await search("aicha.bouazizi@example.test", "a")).data?.length === 8);
  check("Blank search finds nobody", (await search("aicha.bouazizi@example.test", " ")).data?.length === 0);
  const own = await search(`aicha.bouazizi@${preset.domain}`, "Aicha");
  check("Search stays in the caller's tenant", own.status === 200 && own.data.length > 0 && own.data.every((p) => !whole.data.people.some((c) => c.employeeKey === p.employeeKey)));
  check("Search on another date is HR only", (await search("aicha.bouazizi@example.test", "a", "&asOf=2026-12-01")).status === 403
    && (await search("amira.khelifi@example.test", "a", "&asOf=2026-12-01")).status === 200);
  check("A role without the org chart can't search", (await search("omar.mansour@example.test", "a")).status === 403);
  check("No session is 401", (await get(null, "/search?q=a")).status === 401 && (await get(null, `?root=${mariam.employeeKey}`)).status === 401);

  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
