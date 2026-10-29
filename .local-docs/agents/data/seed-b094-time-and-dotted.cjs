#!/usr/bin/env node
/**
 * B-094 session B: gives Carthage Digital Group's org chart what the B-126 canvas shows HR, through the product API
 * as Amira: three dotted lines (Sofiene Jebali → Karim Jaziri, as on the canvas; Lina Rekik → Mariam Gharbi; Nizar
 * Khemiri → Youssef Trabelsi), and three upcoming changes for the time bar: Skander Mejri joins Tarek Ayari's team on
 * 17 Nov 2026, Rafik Sahbi's last day is 30 Nov 2026, Hela Ben Amor moves to Amira Khelifi on 1 Dec 2026.
 *
 * Re-running skips what is already in place. Usage: node .local-docs/agents/data/seed-b094-time-and-dotted.cjs [--dry]
 */
const { call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");

const ADMIN = "amira.khelifi@example.test";
const DRY = process.argv.includes("--dry");
const TODAY = new Date().toISOString().slice(0, 10);
const P = "/api/corehr/employees/people";

const DOTTED = [["Sofiene Jebali", "Karim Jaziri"], ["Lina Rekik", "Mariam Gharbi"], ["Nizar Khemiri", "Youssef Trabelsi"]];
const JOIN = { first: "Skander", last: "Mejri", title: "Product Designer", unit: "Product A Core", location: "Sousse", manager: "Tarek Ayari", start: "2026-11-17" };
const LEAVE = { name: "Rafik Sahbi", lastDay: "2026-11-30" };
const MOVE = { name: "Hela Ben Amor", manager: "Amira Khelifi", date: "2026-12-01" };

const data = (response, what) => {
  if (response.status >= 300) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.json).slice(0, 300)}`);
  return response.json?.data ?? response.json;
};

(async () => {
  const token = await login(ADMIN);
  const get = async (url, what) => data(await call("GET", url, null, token), what);
  const post = async (url, body, what) => {
    console.log(`${DRY ? "WOULD" : "DO"} ${what}`);
    if (!DRY) data(await call("POST", url, body, token), what);
  };
  const option = async (name, date) => {
    const found = (await get(`${P}/manager-options?effectiveDate=${date}&q=${encodeURIComponent(name.split(" ")[0])}&limit=30`, `find ${name}`))
      .find((o) => o.displayName === name);
    if (!found) throw new Error(`no active person named ${name} on ${date}`);
    return found;
  };
  const profile = (key) => get(`${P}/${key}`, `profile ${key}`);

  for (const [name, managerName] of DOTTED) {
    const person = await option(name, TODAY);
    const manager = await option(managerName, TODAY);
    if ((await profile(person.employeeKey)).dottedLineManagers.some((m) => m.employeeKey === manager.employeeKey)) {
      console.log(`SKIP dotted line ${name} → ${managerName}: in place`);
      continue;
    }
    await post(`${P}/${person.employeeKey}/dotted-lines`, { effectiveDate: TODAY, managerEmployeeId: manager.employeeId }, `dotted line ${name} → ${managerName}`);
  }

  const existing = (await get(`${P}?pageSize=50&q=${JOIN.first}`, "find joiner")).items ?? [];
  if (existing.some((p) => p.displayName === `${JOIN.first} ${JOIN.last}`)) console.log(`SKIP join ${JOIN.first} ${JOIN.last}: hired`);
  else {
    const units = new Map();
    const walk = (node) => { units.set(node.unit.name, node.unit.id); (node.children ?? []).forEach(walk); };
    (await get(`/api/corehr/organization/hierarchy?asOf=${TODAY}`, "hierarchy")).roots.forEach(walk);
    const manager = await option(JOIN.manager, JOIN.start);
    await post("/api/corehr/employees/hire", {
      firstName: JOIN.first, lastName: JOIN.last, preferredName: null, workEmail: `${JOIN.first}.${JOIN.last}@example.test`.toLowerCase(),
      phone: null, employeeNumberMode: "Generated", employeeNumber: null, startDate: JOIN.start, employmentType: "Full-time",
      orgUnitId: units.get(JOIN.unit), jobTitle: JOIN.title, location: JOIN.location, primaryManagerEmployeeId: manager.employeeId,
    }, `hire ${JOIN.first} ${JOIN.last} from ${JOIN.start} under ${JOIN.manager}`);
  }

  const leaver = await option(LEAVE.name, TODAY);
  if ((await profile(leaver.employeeKey)).employment.end) console.log(`SKIP last day for ${LEAVE.name}: set`);
  else await post(`${P}/${leaver.employeeKey}/changes/end-employment`, { lastDay: LEAVE.lastDay, note: null }, `last day ${LEAVE.lastDay} for ${LEAVE.name}`);

  const mover = await option(MOVE.name, TODAY);
  const moverProfile = await profile(mover.employeeKey);
  const target = await option(MOVE.manager, MOVE.date);
  if (moverProfile.comingUp.length || moverProfile.primaryManager?.employeeKey === target.employeeKey) console.log(`SKIP move ${MOVE.name}: scheduled`);
  else await post(`${P}/${mover.employeeKey}/changes/job`, { effectiveDate: MOVE.date, managerEmployeeId: target.employeeId }, `move ${MOVE.name} to ${MOVE.manager} on ${MOVE.date}`);

  console.log(DRY ? "dry run, nothing changed" : "done");
})().catch((error) => { console.error(error.message); process.exit(1); });
