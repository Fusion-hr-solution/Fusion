#!/usr/bin/env node
/**
 * B-109: two role changes in Carthage Digital Group, made through the product API as Amira, so Settings › Change
 * history has one of each kind to show.
 *
 * 1. Gives Leila Baccouche the HR partner role (she keeps Employee).
 * 2. Lets the HR partner role manage calibration and see change history.
 *
 * Re-running skips a change that is already in place. Usage: node .local-docs/agents/data/journey-b109-role-changes.cjs
 */
const { BASE, call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");

const ADMIN = "amira.khelifi@example.test";
const PERSON = "Leila Baccouche";
const ROLE = "HR partner";
const ADDED = ["performance.review.calibrate", "settings.governance.view"];

const data = (response, what) => {
  if (response.status >= 300) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.json).slice(0, 300)}`);
  return response.json?.data ?? response.json;
};

(async () => {
  const token = await login(ADMIN);
  const roles = data(await call("GET", "/api/identity/core-access/profiles", null, token), "roles");
  const role = roles.find((profile) => profile.name === ROLE);
  if (!role) throw new Error(`no ${ROLE} role`);

  const people = data(await call("GET", "/api/identity/core-access/assignments", null, token), "assignments");
  const person = people.find((assignment) => assignment.fullName === PERSON);
  if (!person) throw new Error(`no ${PERSON}`);
  if (person.accessProfiles.some((profile) => profile.id === role.id)) {
    console.log(`${PERSON} already holds ${ROLE}`);
  } else {
    const ids = [...person.accessProfiles.map((profile) => profile.id), role.id];
    data(await call("PUT", `/api/identity/core-access/assignments/${person.userId}`, { accessProfileIds: ids }, token), "assign");
    console.log(`Gave ${PERSON} the ${ROLE} role`);
  }

  const missing = ADDED.filter((key) => !role.grants.some((grant) => grant.permissionKey === key));
  if (missing.length === 0) {
    console.log(`${ROLE} already has ${ADDED.join(", ")}`);
  } else {
    // Updates need the role's version in If-Match, which the helper's call() doesn't send.
    const response = await fetch(`${BASE}/api/identity/core-access/profiles/${role.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "If-Match": `"${role.version}"` },
      body: JSON.stringify({
        name: role.name,
        description: role.description,
        grants: [
          ...role.grants.map((grant) => ({ permissionKey: grant.permissionKey, scope: grant.scope })),
          ...missing.map((permissionKey) => ({ permissionKey, scope: "Tenant" })),
        ],
      }),
    });
    if (!response.ok) throw new Error(`update role: ${response.status} ${(await response.text()).slice(0, 300)}`);
    console.log(`${ROLE} now has ${missing.join(", ")}`);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
