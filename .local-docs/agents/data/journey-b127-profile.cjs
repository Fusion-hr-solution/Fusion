#!/usr/bin/env node
/**
 * B-127/B-129 session 1: the profile's Personal tab, photos and job history, through the shell like the browser.
 * Aicha (employee, reports to Mariam) edits her own Personal tab and photo. Mariam (her manager) sees her mobile
 * only and changes nothing; Leila (colleague) and Omar (another branch, no team view) see the preferred name only;
 * Amira (HR) sees and edits everything. Bad input, a stale version, someone else's photo, a non-image and a too-large
 * file are refused; another tenant gets 404 and no session gets 401. Job history: HR and Mariam, nobody else.
 * Restores Aicha's Personal tab and removes her photo at the end, so it can be re-run (each run adds history rows).
 * Usage: node .local-docs/agents/data/journey-b127-profile.cjs
 */
const { BASE, call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");
const presets = require("./demo-presets.local.json");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`); };
const HR = "amira.khelifi@example.test";
const SELF = "aicha.bouazizi@example.test";
const MANAGER = "mariam.gharbi@example.test";
const COLLEAGUE = "leila.baccouche@example.test";
const OTHER_MANAGER = "omar.mansour@example.test";

const tokens = {};
const token = async (email) => (tokens[email] ??= await login(email));
const people = (key) => `/api/corehr/employees/people/${encodeURIComponent(key)}`;

async function put(email, path, body, version) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await token(email)}`,
      ...(version === undefined ? {} : { "If-Match": `"${version}"` }),
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

async function upload(email, key, bytes, name, type) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const r = await fetch(`${BASE}${people(key)}/photo`, { method: "POST", headers: { Authorization: `Bearer ${await token(email)}` }, body: form });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

async function raw(email, path) {
  const r = await fetch(`${BASE}${path}`, { headers: email ? { Authorization: `Bearer ${await token(email)}` } : {} });
  return { status: r.status, type: r.headers.get("content-type"), cache: r.headers.get("cache-control"), bytes: Buffer.from(await r.arrayBuffer()) };
}

// A real 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

(async () => {
  const chart = (await call("GET", "/api/corehr/org-chart", null, await token(HR))).json.data;
  const keyOf = (name) => chart.people.find((p) => p.displayName === name)?.employeeKey;
  const aicha = keyOf("Aicha Bouazizi");
  check("Aicha is on HR's chart", Boolean(aicha));

  const before = (await call("GET", `${people(aicha)}/personal`, null, await token(SELF))).json.data;
  check("Aicha reads her own Personal tab in full and may edit it", before.access === "Full" && before.canEdit === true, before.access);

  const body = {
    preferredName: before.preferredName,
    mobile: "+216 98 123 456",
    personalEmail: "aicha.home@example.test",
    homeAddress: { street: "14 Rue Ibn Khaldoun", city: "Tunis", postalCode: "1002", country: "Tunisia" },
    dateOfBirth: "1995-03-18",
    emergencyContacts: [
      { name: "Sonia Bouazizi", relationship: "Mother", phone: "+216 22 345 678" },
      { name: "Karim Bouazizi", relationship: "Brother", phone: "+216 55 876 543" },
    ],
  };
  const saved = await put(SELF, `${people(aicha)}/personal`, body, before.version);
  check("Aicha's own change applies at once", saved.status === 200 && saved.json.data.personalEmail === "aicha.home@example.test"
    && saved.json.data.emergencyContacts.length === 2 && saved.json.data.version !== before.version, `${saved.status}`);

  const asManager = (await call("GET", `${people(aicha)}/personal`, null, await token(MANAGER))).json.data;
  check("Mariam (her manager) sees the mobile and nothing private", asManager.access === "Contact" && asManager.mobile === "+216 98 123 456"
    && asManager.personalEmail === null && asManager.homeAddress === null && asManager.dateOfBirth === null && asManager.emergencyContacts === null);
  for (const [who, email] of [["Leila (colleague)", COLLEAGUE], ["Omar (another branch)", OTHER_MANAGER]]) {
    const view = (await call("GET", `${people(aicha)}/personal`, null, await token(email))).json.data;
    check(`${who} sees the preferred name only`, view.access === "Directory" && view.mobile === null && view.personalEmail === null && view.emergencyContacts === null);
  }
  const colleagueProfile = (await call("GET", people(aicha), null, await token(COLLEAGUE))).json.data;
  check("Leila's view of the profile has no phone", colleagueProfile.identity.phone === null);
  const managerProfile = (await call("GET", people(aicha), null, await token(MANAGER))).json.data;
  check("Mariam's view of the profile has the phone", managerProfile.identity.phone === "+216 98 123 456");

  for (const [who, email] of [["Leila", COLLEAGUE], ["Mariam", MANAGER], ["Omar", OTHER_MANAGER]]) {
    const r = await put(email, `${people(aicha)}/personal`, body, saved.json.data.version);
    check(`${who} can't change Aicha's details`, r.status === 403, `${r.status}`);
  }

  const asHr = (await call("GET", `${people(aicha)}/personal`, null, await token(HR))).json.data;
  check("Amira (HR) sees everything and may edit", asHr.access === "Full" && asHr.canEdit && asHr.dateOfBirth === "1995-03-18");
  check("A stale version is a conflict", (await put(HR, `${people(aicha)}/personal`, body, before.version)).status === 409);
  check("No If-Match is refused", (await put(HR, `${people(aicha)}/personal`, body)).status === 412);
  const four = { ...body, emergencyContacts: [...body.emergencyContacts, ...body.emergencyContacts] };
  check("A fourth emergency contact is refused", (await put(HR, `${people(aicha)}/personal`, four, asHr.version)).status === 400);
  check("A future date of birth is refused", (await put(HR, `${people(aicha)}/personal`, { ...body, dateOfBirth: "2999-01-01" }, asHr.version)).status === 400);

  const timeline = (await call("GET", `${people(aicha)}/timeline`, null, await token(HR))).json.data.timeline;
  const entry = timeline.find((e) => e.kind === "PersonalDetails");
  check("The change is in her history, sections only", entry?.title === "Updated contact details"
    && entry.fields.some((f) => f.label === "Mobile") && entry.fields.every((f) => f.from === null && f.to === null));

  // --- Photos
  const photo = await upload(SELF, aicha, PNG, "me.png", "image/png");
  const photoUrl = photo.json?.data?.photoUrl;
  check("Aicha sets her photo", photo.status === 200 && photoUrl?.startsWith(`/corehr/employees/people/${aicha}/photo?v=`), `${photo.status}`);
  const fetched = await raw(COLLEAGUE, `/api${photoUrl}`);
  check("A colleague loads it, cached for good at this version", fetched.status === 200 && fetched.type === "image/png"
    && fetched.bytes.equals(PNG) && /immutable/.test(fetched.cache ?? ""), `${fetched.status} ${fetched.cache}`);
  const unversioned = await raw(COLLEAGUE, `${people(aicha)}/photo`);
  check("Without the version it isn't cached", unversioned.status === 200 && /no-cache/.test(unversioned.cache ?? ""));
  const hrChart = (await call("GET", "/api/corehr/org-chart", null, await token(HR))).json.data;
  check("Her org chart card carries the address", hrChart.people.find((p) => p.employeeKey === aicha)?.photoUrl === photoUrl);
  const list = (await call("GET", `/api/corehr/employees/people?q=${encodeURIComponent("Aicha")}`, null, await token(HR))).json.data;
  check("Her people row carries it", list.items.find((p) => p.employeeKey === aicha)?.photoUrl === photoUrl);
  check("Her profile carries it", (await call("GET", people(aicha), null, await token(MANAGER))).json.data.identity.photoUrl === photoUrl);
  check("Her own card carries it", (await call("GET", "/api/corehr/me/card", null, await token(SELF))).json.data.photoUrl === photoUrl);

  check("Leila can't set Aicha's photo", (await upload(COLLEAGUE, aicha, PNG, "x.png", "image/png")).status === 403);
  check("Mariam can't remove Aicha's photo", (await call("DELETE", `${people(aicha)}/photo`, null, await token(MANAGER))).status === 403);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
  check("A non-image named .png is refused", (await upload(SELF, aicha, svg, "me.png", "image/png")).status === 400);
  const big = Buffer.alloc(5 * 1024 * 1024 + 1);
  PNG.copy(big);
  const tooBig = await upload(SELF, aicha, big, "big.png", "image/png");
  check("A photo over 5 MB is refused", tooBig.status === 400 || tooBig.status === 413, `${tooBig.status}`);
  check("The photo is unchanged after the refusals", (await call("GET", people(aicha), null, await token(HR))).json.data.identity.photoUrl === photoUrl);

  // --- Job history
  const history = await call("GET", `${people(aicha)}/job-history`, null, await token(HR));
  check("HR reads her job history, the current row marked", history.status === 200 && history.json.data.rows[0]?.isCurrent === true
    && history.json.data.rows[0].manager?.displayName === "Mariam Gharbi", `${history.status}`);
  check("Mariam reads it", (await call("GET", `${people(aicha)}/job-history`, null, await token(MANAGER))).status === 200);
  check("Leila can't", (await call("GET", `${people(aicha)}/job-history`, null, await token(COLLEAGUE))).status === 403);
  check("Omar can't", (await call("GET", `${people(aicha)}/job-history`, null, await token(OTHER_MANAGER))).status === 403);

  // --- Another tenant and no session
  const foreignHr = `amira.khelifi@${presets.presets.planning.domain}`;
  check("Another tenant's HR doesn't find her details", (await call("GET", `${people(aicha)}/personal`, null, await token(foreignHr))).status === 404);
  check("…nor her photo", (await raw(foreignHr, `/api${photoUrl}`)).status === 404);
  check("…nor can set it", (await upload(foreignHr, aicha, PNG, "x.png", "image/png")).status === 404);
  check("…nor change her details", (await put(foreignHr, `${people(aicha)}/personal`, body, 1)).status === 404);
  check("No session is 401", (await raw(null, `${people(aicha)}/personal`)).status === 401);

  // --- Leave Aicha as she was
  const removed = await call("DELETE", `${people(aicha)}/photo`, null, await token(SELF));
  check("Aicha removes her photo", removed.status === 200 && removed.json.data.photoUrl === null);
  const current = (await call("GET", `${people(aicha)}/personal`, null, await token(HR))).json.data;
  const restore = {
    preferredName: before.preferredName, mobile: before.mobile, personalEmail: before.personalEmail,
    homeAddress: before.homeAddress, dateOfBirth: before.dateOfBirth, emergencyContacts: before.emergencyContacts ?? [],
  };
  check("Her Personal tab is restored", (await put(HR, `${people(aicha)}/personal`, restore, current.version)).status === 200);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(1); });
