#!/usr/bin/env node
/**
 * B-127: fills the profile's Personal tab for the people on demo screens: Mariam Gharbi, Aicha Bouazizi,
 * Amira Khelifi and Mariam's direct reports. Fictional values only (@example.test, +216 numbers), written by
 * Amira (HR) through PUT /personal, so each change lands in history like a real edit.
 * Idempotent: a person whose tab already matches is skipped (no new history row).
 * Usage: node .local-docs/agents/data/seed-b127-personal.cjs
 */
const { BASE, call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");

const HR = "amira.khelifi@example.test";
const people = (key) => `/api/corehr/employees/people/${encodeURIComponent(key)}`;

const CITIES = [
  ["Ariana", "2080"], ["Tunis", "1002"], ["La Marsa", "2070"], ["Nabeul", "8000"], ["Sousse", "4000"],
  ["Sfax", "3000"], ["Ben Arous", "2013"], ["Bizerte", "7000"],
];
const STREETS = [
  "Rue Ibn Khaldoun", "Avenue Habib Bourguiba", "Rue de Marseille", "Rue Alain Savary", "Avenue de la Liberté",
  "Rue du Lac Biwa", "Rue Hédi Nouira", "Avenue Taïeb Mhiri",
];
const RELATIONS = ["Mother", "Father", "Brother", "Sister", "Spouse"];
const FIRST = ["Sonia", "Karim", "Nadia", "Hichem", "Salma", "Walid", "Ines", "Mehdi"];

// Stable per person, so a re-run writes the same values.
function hash(text) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
const pick = (list, h, salt = 0) => list[(h >>> salt) % list.length];
const phone = (h, prefix) => `+216 ${prefix}${h % 10} ${String(100 + (h % 900)).padStart(3, "0")} ${String(100 + ((h >>> 7) % 900)).padStart(3, "0")}`;

function personalFor(person, current) {
  const h = hash(person.displayName);
  const [first, ...rest] = person.displayName.split(" ");
  const last = rest.at(-1) ?? first;
  const [city, postalCode] = pick(CITIES, h);
  const year = 1975 + (h % 26);
  const month = String(1 + (h % 12)).padStart(2, "0");
  const day = String(1 + ((h >>> 5) % 28)).padStart(2, "0");
  const contacts = [{ name: `${pick(FIRST, h, 3)} ${last}`, relationship: pick(RELATIONS, h, 5), phone: phone(h >>> 9, "9") }];
  if (h % 3 === 0) contacts.push({ name: `${pick(FIRST, h, 11)} ${last}`, relationship: pick(RELATIONS, h, 13), phone: phone(h >>> 15, "5") });
  return {
    preferredName: current.preferredName,
    mobile: phone(h, "2"),
    personalEmail: `${first}.${last}.home@example.test`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    homeAddress: { street: `${1 + (h % 60)} ${pick(STREETS, h, 2)}`, city, postalCode, country: "Tunisia" },
    dateOfBirth: `${year}-${month}-${day}`,
    emergencyContacts: contacts,
  };
}

const same = (body, current) =>
  JSON.stringify([body.mobile, body.personalEmail, body.homeAddress, body.dateOfBirth, body.emergencyContacts]) ===
  JSON.stringify([current.mobile, current.personalEmail, current.homeAddress, current.dateOfBirth, current.emergencyContacts]);

(async () => {
  const token = await login(HR);
  const chart = (await call("GET", "/api/corehr/org-chart", null, token)).json.data;
  const byName = (name) => chart.people.find((p) => p.displayName === name);
  const mariam = byName("Mariam Gharbi");
  const team = chart.people.filter((p) => p.managerKey === mariam.employeeKey);
  const targets = [mariam, byName("Aicha Bouazizi"), byName("Amira Khelifi"), ...team]
    .filter((p, i, all) => p && all.findIndex((q) => q?.employeeKey === p.employeeKey) === i);

  let written = 0;
  for (const person of targets) {
    const current = (await call("GET", `${people(person.employeeKey)}/personal`, null, token)).json.data;
    const body = personalFor(person, current);
    if (same(body, current)) {
      console.log(`same    ${person.displayName}`);
      continue;
    }
    const r = await fetch(`${BASE}${people(person.employeeKey)}/personal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "If-Match": `"${current.version}"` },
      body: JSON.stringify(body),
    });
    if (r.status !== 200) throw new Error(`${person.displayName}: ${r.status} ${await r.text()}`);
    written++;
    console.log(`written ${person.displayName}`);
  }
  console.log(`${targets.length} people, ${written} written.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
