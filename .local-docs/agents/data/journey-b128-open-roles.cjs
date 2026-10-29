#!/usr/bin/env node
/**
 * B-128: open roles on the org chart, through the product API as people would use it.
 * Amira (HR) adds Senior Product Designer under Fares Lachheb (from January) and Data Engineer under Walid Dridi
 * (on hold, then opened, from December), the two roles of the accepted B-126 canvas. Aicha (employee) and Mariam
 * (manager) see open roles and not on-hold ones, can't add or edit; bad input is refused; Filled and Closed leave
 * the chart; a past date shows none; another tenant neither sees nor edits them.
 * Leaves Carthage with those two open roles (earlier runs' copies are closed first), so it can be re-run.
 * Usage: node .local-docs/agents/data/journey-b128-open-roles.cjs
 */
const { call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");
const presets = require("./demo-presets.local.json");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`); };
const HR = "amira.khelifi@example.test";
const EMPLOYEE = "aicha.bouazizi@example.test";
const MANAGER = "mariam.gharbi@example.test";
const chart = async (email, query = "") => (await call("GET", `/api/corehr/org-chart${query}`, null, await login(email))).json?.data;
const send = async (email, method, path, body) => call(method, `/api/corehr/org-chart/open-roles${path}`, body, await login(email));
const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const january = iso(new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 4)));
const december = iso(new Date(Date.UTC(now.getUTCFullYear(), 11, 1)));
const TITLES = ["Senior Product Designer", "Data Engineer", "Journey Probe"];

(async () => {
  const hrChart = await chart(HR);
  const byName = (name) => hrChart.people.find((p) => p.displayName === name);
  const fares = byName("Fares Lachheb");
  const walid = byName("Walid Dridi");
  check("Fares and Walid are on the chart", Boolean(fares && walid));

  // Earlier runs: close their roles so the chart ends with one of each.
  for (const role of hrChart.openRoles.filter((r) => TITLES.includes(r.jobTitle))) {
    await send(HR, "PUT", `/${role.id}`, { jobTitle: role.jobTitle, managerKey: role.managerKey, orgUnitId: role.unit.id, targetStartDate: role.targetStartDate, status: "Closed" });
  }

  const designer = await send(HR, "POST", "", { jobTitle: "Senior Product Designer", managerKey: fares.employeeKey, orgUnitId: fares.unit.id, targetStartDate: january });
  check("HR adds an open role under Fares", designer.status === 201 && designer.json.data.status === "Open" && designer.json.data.unit?.name === fares.unit.name, `${designer.status}`);
  const engineer = await send(HR, "POST", "", { jobTitle: "Data Engineer", managerKey: walid.employeeKey, orgUnitId: walid.unit.id, targetStartDate: december, status: "OnHold" });
  check("HR adds an on-hold role under Walid", engineer.status === 201 && engineer.json.data.status === "OnHold", `${engineer.status}`);

  const seen = (data, id) => data.openRoles.some((r) => r.id === id);
  let asEmployee = await chart(EMPLOYEE);
  check("Aicha sees the open role under Fares", seen(asEmployee, designer.json.data.id) && asEmployee.openRoles.find((r) => r.id === designer.json.data.id).managerKey === fares.employeeKey);
  check("Aicha doesn't see the on-hold role", !seen(asEmployee, engineer.json.data.id));
  check("HR sees the on-hold role", seen(await chart(HR), engineer.json.data.id));
  check("Mariam sees the open role", seen(await chart(MANAGER), designer.json.data.id));

  const opened = await send(HR, "PUT", `/${engineer.json.data.id}`, { jobTitle: "Data Engineer", managerKey: walid.employeeKey, orgUnitId: walid.unit.id, targetStartDate: december, status: "Open" });
  check("HR opens the on-hold role", opened.status === 200 && opened.json.data.status === "Open");
  asEmployee = await chart(EMPLOYEE);
  check("Aicha now sees it under Walid", seen(asEmployee, engineer.json.data.id));

  const body = { jobTitle: "Journey Probe", managerKey: fares.employeeKey, orgUnitId: fares.unit.id };
  check("Aicha can't add a role", (await send(EMPLOYEE, "POST", "", body)).status === 403);
  check("Mariam can't add a role", (await send(MANAGER, "POST", "", body)).status === 403);
  check("Aicha can't edit a role", (await send(EMPLOYEE, "PUT", `/${designer.json.data.id}`, { ...body, status: "Closed" })).status === 403);
  check("An empty title is refused", (await send(HR, "POST", "", { ...body, jobTitle: " " })).status === 400);
  check("An unknown manager is refused", (await send(HR, "POST", "", { ...body, managerKey: "EMP-NOPE" })).status === 400);
  check("A past target start is refused", (await send(HR, "POST", "", { ...body, targetStartDate: "2020-01-01" })).status === 400);
  check("A new role can't start filled", (await send(HR, "POST", "", { ...body, status: "Filled" })).status === 400);
  check("An unknown role is not found", (await send(HR, "PUT", `/00000000-0000-0000-0000-000000000001`, body)).status === 404);

  const probe = await send(HR, "POST", "", body);
  const filled = await send(HR, "PUT", `/${probe.json.data.id}`, { ...body, status: "Filled" });
  check("Filled takes a role off the chart", filled.status === 200 && !seen(await chart(HR), probe.json.data.id));
  await send(HR, "PUT", `/${probe.json.data.id}`, { ...body, status: "Closed" });

  const past = await chart(HR, `?asOf=${iso(new Date(Date.now() - 30 * 864e5))}`);
  check("A past date shows no open roles", past.openRoles.length === 0);

  const preset = presets.presets.planning;
  const other = await chart(`aicha.bouazizi@${preset.domain}`);
  check("Another tenant doesn't see Carthage's roles", other && !seen(other, designer.json.data.id) && !seen(other, engineer.json.data.id));
  const foreign = await call("PUT", `/api/corehr/org-chart/open-roles/${designer.json.data.id}`, body, await login(`amira.khelifi@${preset.domain}`).catch(() => null));
  check("Another tenant's HR can't edit Carthage's role", foreign.status === 404 || foreign.status === 403, `${foreign.status}`);
  check("No session is 401", (await call("POST", "/api/corehr/org-chart/open-roles", body, null)).status === 401);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(1); });
