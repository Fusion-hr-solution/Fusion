#!/usr/bin/env node
/**
 * B-132: a tenant above the org chart's 3,000-person limit, through the product API (the demo-preset foundation:
 * provision, Amira's bootstrap activation, organization and workforce imports). The Carthage 100 come first, then
 * two more levels: each of the 80 individual contributors leads six people, and each of those leads six, for 3,460
 * people seven levels deep. Only Amira (tenant administrator, HR) gets an account.
 * Usage: node .local-docs/agents/data/seed-b132-large-tenant.mjs   (records the tenant in large-tenant.local.json)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFoundation, emailFor, roster } from "./demo-presets/foundation.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const record = path.join(here, "large-tenant.local.json");
const existing = await fs.readFile(record, "utf8").then(JSON.parse).catch(() => null);
if (existing) {
  console.log(`Already built: ${existing.name} (${existing.tenantId}), sign in as ${existing.amira}`);
  process.exit(0);
}

const asOf = new Date().toISOString().slice(0, 10);
const domain = `scale-${Date.now().toString(36)}.example.test`;
const base = roster(domain, asOf);
const firsts = [...new Set(base.map((p) => p.firstName))];
const lasts = [...new Set(base.map((p) => p.lastName))];
const titles = ["Software Engineer", "Data Analyst", "Consultant", "Designer", "QA Engineer", "Support Specialist", "Accountant", "Recruiter"];
const locations = ["Tunis", "Ariana", "Sfax", "Sousse", "Monastir", "Nabeul", "Remote - Tunisia"];

const people = [...base];
let n = 0;
function add(manager) {
  n++;
  const first = firsts[(n * 7) % firsts.length];
  const last = lasts[(n * 13) % lasts.length];
  const start = new Date(`${asOf}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 30 - ((n * 37) % 1800));
  const person = {
    index: 100 + n,
    employeeNumber: `CDG-X${String(n).padStart(4, "0")}`,
    firstName: first,
    lastName: last,
    name: `${first} ${last}`,
    email: emailFor(`${first}.${n}`, last, domain),
    startDate: start.toISOString().slice(0, 10),
    organization: manager.organization,
    title: titles[n % titles.length],
    location: locations[n % locations.length],
    workerReference: `CDG-WX${String(n).padStart(4, "0")}`,
    managerReference: manager.workerReference,
  };
  people.push(person);
  return person;
}
const contributors = base.filter((p) => p.index > 20);
const leads = contributors.flatMap((ic) => Array.from({ length: 6 }, () => add(ic)));
for (const lead of leads) for (let i = 0; i < 6; i++) add(lead);

const name = `Carthage at Scale · ${people.length}`;
console.log(`${name}: ${people.length} people at ${domain}`);
const started = Date.now();
const { tenantId } = await buildFoundation({
  name, domain, asOf, people,
  work: path.join(here, "demo-presets", ".work", "b132-large"),
  log: (line) => console.log(`  ${Math.round((Date.now() - started) / 1000)}s ${line}`),
});
await fs.writeFile(record, JSON.stringify({ name, tenantId, domain, asOf, amira: base[1].email, people: people.length }, null, 2) + "\n");
console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: sign in as ${base[1].email}`);
