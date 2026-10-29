#!/usr/bin/env node
/**
 * B-094 session A: the people org chart API journey (`GET /api/corehr/org-chart`), read-only.
 * Aicha (employee) and Mariam (manager) see the whole company with their own key; units follow reporting lines
 * (B-125); nothing confidential is sent; another date than today is refused to them and served to HR (Amira);
 * Omar's custom role has no org chart (403); a preset tenant's Aicha sees only her tenant; no session is 401.
 * Session B: dotted lines reach every viewer; only HR gets full start dates and the changes feed (joins, leavers,
 * moves from `seed-b094-time-and-dotted.cjs`) and sees them land on their dates; a duplicate dotted line is refused,
 * and an employee can't add one. Read-only apart from those refused writes.
 * Usage: node .local-docs/agents/data/journey-b094-org-chart.cjs
 */
const { call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");
const presets = require("./demo-presets.local.json");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`); };
const chart = async (email, query = "") => {
  const r = await call("GET", `/api/corehr/org-chart${query}`, null, await login(email));
  return { status: r.status, data: r.json?.data };
};
const today = new Date().toISOString().slice(0, 10);

(async () => {
  const aicha = await chart("aicha.bouazizi@example.test");
  const me = aicha.data?.people.find((p) => p.employeeKey === aicha.data.viewerKey);
  check("Aicha sees the whole company at Tenant scope", aicha.status === 200 && aicha.data.scope === "Tenant" && aicha.data.people.length === 100, `${aicha.data?.people.length} people`);
  check("Aicha's own card is hers", me?.displayName === "Aicha Bouazizi");
  const mariam = aicha.data.people.find((p) => p.displayName === "Mariam Gharbi");
  check("Aicha sits under Mariam in Mariam's unit (B-125)", me?.managerKey === mariam?.employeeKey && me?.unit?.name === "Product" && mariam.unit.name === "Product", me?.unit?.name);
  const divisions = new Set(aicha.data.people.map((p) => p.unit?.divisionName).filter(Boolean));
  check("Three divisions", divisions.size === 3, [...divisions].join(", "));
  const sami = aicha.data.people.find((p) => p.managerKey === null);
  check("One top of the company with everyone below", sami?.displayName === "Sami Ben Youssef" && sami.totalCount === 99, `${sami?.displayName} ${sami?.totalCount}`);
  const fields = new Set(aicha.data.people.flatMap((p) => Object.keys(p)));
  check("No phone, hire date, status or contract sent", !["phone", "hireDate", "employmentStatus", "employmentType"].some((f) => fields.has(f)));

  const asManager = await chart("mariam.gharbi@example.test");
  check("Mariam sees the whole company too", asManager.status === 200 && asManager.data.people.length === 100 && asManager.data.viewerKey === mariam.employeeKey);

  const future = await chart("aicha.bouazizi@example.test", "?asOf=2026-12-01");
  check("Another date is refused to an employee", future.status === 403, String(future.status));
  const todayExplicit = await chart("aicha.bouazizi@example.test", `?asOf=${today}`);
  check("Today, asked by date, is served", todayExplicit.status === 200);
  const past = await chart("amira.khelifi@example.test", "?asOf=2026-09-15");
  check("HR reads a past date", past.status === 200 && past.data.asOf === "2026-09-15", `${past.status} ${past.data?.people.length} people`);

  const omar = await chart("omar.mansour@example.test");
  check("A role without the org chart is refused", omar.status === 403, String(omar.status));

  const preset = presets.presets.planning;
  const other = await chart(`aicha.bouazizi@${preset.domain}`);
  const ownIds = new Set(aicha.data.people.map((p) => p.employeeKey));
  check("Another tenant's Aicha sees only her tenant", other.status === 200 && other.data.people.every((p) => !ownIds.has(p.employeeKey)), `${other.status} ${other.data?.people.length} people`);

  // ── Session B: dotted lines, HR time ──
  const byName = (data, name) => data.people.find((p) => p.displayName === name);
  const sofiene = byName(aicha.data, "Sofiene Jebali");
  const karim = byName(aicha.data, "Karim Jaziri");
  check("Everyone sees Sofiene's dotted line to Karim", sofiene?.dottedLineManagerKeys.includes(karim?.employeeKey));
  check("Only HR gets full start dates", aicha.data.people.every((p) => p.startDate === null) && (await chart("amira.khelifi@example.test")).data.people.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.startDate)));

  const changes = async (email, query) => {
    const r = await call("GET", `/api/corehr/org-chart/changes${query}`, null, await login(email));
    return { status: r.status, data: r.json?.data };
  };
  const window = `?from=${today}&to=2026-12-31`;
  check("Changes are refused to an employee", (await changes("aicha.bouazizi@example.test", window)).status === 403);
  check("Changes are refused to a manager", (await changes("mariam.gharbi@example.test", window)).status === 403);
  const coming = await changes("amira.khelifi@example.test", window);
  const kinds = (coming.data ?? []).map((c) => `${c.kind} ${c.date}`);
  const join = coming.data?.find((c) => c.kind === "Join" && c.person?.displayName === "Skander Mejri");
  const tarek = byName(aicha.data, "Tarek Ayari");
  check("HR sees Skander join Tarek on 17 Nov", join?.date === "2026-11-17" && join.managerKey === tarek?.employeeKey && join.person.jobTitle === "Product Designer", kinds.join("; "));
  const rafik = byName(aicha.data, "Rafik Sahbi");
  check("HR sees Rafik's last day, 30 Nov", coming.data?.some((c) => c.kind === "Leave" && c.employeeKey === rafik?.employeeKey && c.date === "2026-11-30"));
  const hela = byName(aicha.data, "Hela Ben Amor");
  const amira = byName(aicha.data, "Amira Khelifi");
  check("HR sees Hela move to Amira on 1 Dec", coming.data?.some((c) => c.kind === "Move" && c.employeeKey === hela?.employeeKey && c.managerKey === amira?.employeeKey && c.date === "2026-12-01"));
  check("A window past two years is refused", (await changes("amira.khelifi@example.test", "?from=2025-01-01&to=2027-06-01")).status === 400);

  const december = await chart("amira.khelifi@example.test", "?asOf=2026-12-01");
  const at = (name) => byName(december.data, name);
  check("On 1 Dec: Skander under Tarek, Rafik gone, Hela under Amira",
    at("Skander Mejri")?.managerKey === tarek?.employeeKey && !at("Rafik Sahbi") && at("Hela Ben Amor")?.managerKey === amira?.employeeKey,
    `${december.data?.people.length} people`);

  const sofieneProfile = await call("GET", `/api/corehr/employees/people/${sofiene?.employeeKey}`, null, await login("amira.khelifi@example.test"));
  check("Sofiene's profile lists Karim as dotted-line manager", sofieneProfile.json?.data?.dottedLineManagers?.some((m) => m.employeeKey === karim?.employeeKey));
  const karimId = (await call("GET", `/api/corehr/employees/people/manager-options?effectiveDate=${today}&q=Karim&limit=30`, null, await login("amira.khelifi@example.test"))).json?.data?.find((o) => o.displayName === "Karim Jaziri")?.employeeId;
  const duplicate = await call("POST", `/api/corehr/employees/people/${sofiene?.employeeKey}/dotted-lines`, { effectiveDate: today, managerEmployeeId: karimId }, await login("amira.khelifi@example.test"));
  check("A second identical dotted line is refused", duplicate.status >= 400 && duplicate.status !== 403 && duplicate.status < 500, String(duplicate.status));
  const byEmployee = await call("POST", `/api/corehr/employees/people/${sofiene?.employeeKey}/dotted-lines`, { effectiveDate: today, managerEmployeeId: karimId }, await login("aicha.bouazizi@example.test"));
  check("An employee can't add a dotted line", byEmployee.status === 403, String(byEmployee.status));

  const anonymous = await call("GET", "/api/corehr/org-chart");
  check("No session is 401", anonymous.status === 401, String(anonymous.status));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => { console.error(error.message); process.exit(1); });
