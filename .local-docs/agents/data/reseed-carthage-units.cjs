#!/usr/bin/env node
/**
 * B-125: moves Carthage Digital Group's people into units that follow their reporting lines, so the org chart and
 * People read right in demos. Each manager's team sits in one unit under its division: the mapping is the B-126
 * card canvas's (`plans/B-126-screens/card-canvas.html`, RAW: name, title, unit, …). Managers, titles, locations and
 * start dates already match it; only units change.
 *
 * As Amira, through Change work (`POST /api/corehr/employees/people/{key}/change-work`), effective today, keeping each
 * person's title and location. Re-running skips people already in their unit.
 * Usage: node .local-docs/agents/data/reseed-carthage-units.cjs [--dry]
 */
const fs = require("fs");
const path = require("path");
const { call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");

const ADMIN = "amira.khelifi@example.test";
const DRY = process.argv.includes("--dry");
const TODAY = new Date().toISOString().slice(0, 10);

const data = (response, what) => {
  if (response.status >= 300) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.json).slice(0, 300)}`);
  return response.json?.data ?? response.json;
};

(async () => {
  const canvas = fs.readFileSync(path.join(__dirname, "..", "plans", "B-126-screens", "card-canvas.html"), "utf8");
  const target = new Map(JSON.parse(canvas.match(/const RAW = (\[\[.*?\]\]);/)[1]).map(([name, , unit]) => [name, unit]));

  const token = await login(ADMIN);
  const units = new Map();
  const walk = (node) => { units.set(node.unit.name, node.unit.id); (node.children ?? []).forEach(walk); };
  data(await call("GET", `/api/corehr/organization/hierarchy?asOf=${TODAY}`, null, token), "hierarchy").roots.forEach(walk);

  const people = data(await call("GET", "/api/corehr/employees/people?pageSize=200", null, token), "people").items;
  let moved = 0, skipped = 0;
  for (const person of people) {
    const unit = target.get(person.displayName);
    if (!unit) { console.log(`SKIP ${person.displayName}: not in the canvas`); skipped++; continue; }
    if (person.work.organizationName === unit) { skipped++; continue; }
    const orgUnitId = units.get(unit);
    if (!orgUnitId) throw new Error(`no unit ${unit}`);
    console.log(`${DRY ? "WOULD MOVE" : "MOVE"} ${person.displayName}: ${person.work.organizationName} → ${unit}`);
    if (DRY) continue;
    data(await call("POST", `/api/corehr/employees/people/${person.employeeKey}/change-work`, {
      effectiveDate: TODAY, orgUnitId, jobTitle: person.work.jobTitle, location: person.work.location,
    }, token), `change work ${person.displayName}`);
    moved++;
  }
  console.log(`${moved} moved, ${skipped} already in place (${people.length} people)`);
})().catch((error) => { console.error(error.message); process.exit(1); });
