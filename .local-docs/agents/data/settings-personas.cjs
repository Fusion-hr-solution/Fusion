// B-071 settings personas for the live screens of boards 14 and 15, through the shell's /api as Amira.
// Creates two Carthage roles and adds each to one existing account (their own roles stay):
// - "HR partner" (Rim Mahjoub): reads employee fields and Performance settings, changes neither.
// - "Performance lead" (Khaled Sassi): runs cycles and owns the Performance framework; reads people and organization.
//   node .local-docs/agents/data/settings-personas.cjs          add the roles and assignments (idempotent)
//   node .local-docs/agents/data/settings-personas.cjs --undo   take them off both people and delete the roles
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const ROLES = [
  {
    name: "HR partner",
    description: "Reads people and the framework",
    holder: "rim.mahjoub@example.test",
    grants: [
      ["settings.peopleData.view", "Tenant"],
      ["performance.settings.view", "Tenant"],
    ],
  },
  {
    name: "Performance lead",
    description: "Runs cycles and owns the performance framework",
    holder: "khaled.sassi@example.test",
    grants: [
      ["performance.cycle.view", "Tenant"],
      ["performance.cycle.manage", "Tenant"],
      ["performance.settings.view", "Tenant"],
      ["performance.settings.manage", "Tenant"],
      ["performance.objective.org.manage", "Tenant"],
      ["core.employee.view", "Tenant"],
      ["core.organization.view", "Tenant"],
    ],
  },
];

const data = (r) => r.json?.data;
const fail = (step, r) => {
  console.error(`FAIL  ${step}  (${r.status} ${JSON.stringify(r.json?.errors ?? r.json)})`);
  process.exit(1);
};

(async () => {
  const undo = process.argv.includes("--undo");
  const amira = await login("amira.khelifi@example.test");
  let profiles = data(await call("GET", "/api/identity/core-access/profiles", null, amira)) ?? [];
  const people = data(await call("GET", "/api/identity/core-access/assignments", null, amira)) ?? [];

  for (const role of ROLES) {
    let profile = profiles.find((p) => p.name === role.name);
    const person = people.find((p) => p.email === role.holder);
    if (!person) fail(`find ${role.holder}`, { status: 404 });
    const current = person.accessProfiles.map((p) => p.id);

    if (undo) {
      if (profile && current.includes(profile.id)) {
        const r = await call("PUT", `/api/identity/core-access/assignments/${person.userId}`,
          { accessProfileIds: current.filter((id) => id !== profile.id) }, amira);
        if (r.status !== 200) fail(`take ${role.name} off ${role.holder}`, r);
      }
      if (profile) {
        const r = await call("DELETE", `/api/identity/core-access/profiles/${profile.id}`, null, amira);
        if (r.status >= 300) fail(`delete ${role.name}`, r);
      }
      console.log(`PASS  ${role.name} removed`);
      continue;
    }

    if (!profile) {
      const r = await call("POST", "/api/identity/core-access/profiles", {
        name: role.name,
        description: role.description,
        grants: role.grants.map(([permissionKey, scope]) => ({ permissionKey, scope })),
      }, amira);
      if (r.status >= 300) fail(`create ${role.name}`, r);
      profile = data(r);
      profiles = [...profiles, profile];
    }
    if (!current.includes(profile.id)) {
      const r = await call("PUT", `/api/identity/core-access/assignments/${person.userId}`,
        { accessProfileIds: [...current, profile.id] }, amira);
      if (r.status !== 200) fail(`give ${role.name} to ${role.holder}`, r);
    }
    console.log(`PASS  ${role.name} held by ${person.fullName}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
