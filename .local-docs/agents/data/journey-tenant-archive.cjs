// B-099 tenant archival API journey, through the shell at http://localhost:3000/api.
//   node .local-docs/agents/data/journey-tenant-archive.cjs
// Archives one retired demo-preset tenant still in the platform list (the change B-099 exists for): a tenant
// administrator is refused, the platform administrator archives it, the record says so and offers nothing, the list
// drops it, archival can't be repeated or undone, its invitation can't be resent, and its people reach nothing.
// Needs at least one "Carthage · … · retired/failed …" tenant in the list; `demo-preset.mjs tidy` archives the rest.
const path = require("path");
const fs = require("fs");
const { call, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

let failed = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const BASE = "/api/identity/platform-admin/tenants";

async function signIn(email) {
  const r = await call("POST", "/api/identity/auth/login", { email, password: PASSWORD });
  return r;
}

(async () => {
  const admin = await signIn("admin@ey-hr.com");
  if (admin.status !== 200) throw new Error(`platform sign-in: ${admin.status}`);
  const token = admin.json.data.accessToken;

  const list = await call("GET", `${BASE}?pageSize=200`, undefined, token);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "demo-presets.local.json"), "utf8"));
  // Re-runnable: once every leftover is archived, the checks run against the newest archived preset tenant.
  const listed = list.json.data.rows.find((row) => /^Carthage · .+ · (retired|failed) /.test(row.name));
  const target = listed ?? { tenantId: manifest.retired.at(-1)?.tenantId, name: "an already archived preset tenant" };
  if (!target.tenantId) throw new Error("No retired preset tenant to archive or check.");
  console.log(`Target: ${target.name} (${target.tenantId})`);

  // A tenant's own administrator holds no platform role.
  const amira = await signIn("amira.khelifi@example.test");
  const refused = await call("POST", `${BASE}/${target.tenantId}/archive`, {}, amira.json?.data?.accessToken);
  check("A tenant administrator can't archive a tenant", refused.status === 403, `${refused.status}`);

  if (listed) {
    const archived = await call("POST", `${BASE}/${target.tenantId}/archive`, {}, token);
    check("The platform administrator archives it", archived.status === 200, `${archived.status}`);
  }

  const detail = (await call("GET", `${BASE}/${target.tenantId}`, undefined, token)).json.data;
  check("The record reads archived and inactive", detail.isArchived === true && detail.isActive === false);
  check("The record offers no invitation action", (detail.bootstrapInvitation?.allowedActions ?? []).length === 0);
  check("The record shows the archival", detail.history.some((entry) => entry.eventType === "TenantArchived"));

  const after = await call("GET", `${BASE}?pageSize=200&search=${encodeURIComponent(target.name)}`, undefined, token);
  check("The list no longer shows it", after.json.data.rows.every((row) => row.tenantId !== target.tenantId), `${after.json.data.totalCount} matching`);

  for (const action of ["archive", "reactivate", "deactivate"]) {
    const again = await call("POST", `${BASE}/${target.tenantId}/${action}`, {}, token);
    check(`${action} after archival is a conflict`, again.status === 409, `${again.status}`);
  }

  if (detail.bootstrapInvitation) {
    const resend = await call(
      "POST", `${BASE}/${target.tenantId}/bootstrap-invitation/${detail.bootstrapInvitation.invitationId}/resend`, {}, token);
    check("Its invitation can't be resent", resend.status === 409, `${resend.status}`);
  }

  const missing = await call("POST", `${BASE}/00000000-0000-0000-0000-000000000001/archive`, {}, token);
  check("An unknown tenant is not found", missing.status === 404, `${missing.status}`);

  // Its people (any archived preset tenant whose domain the manifest knows): access is refused on every request,
  // as for a deactivated tenant; a sign-in still answers, but the session reaches nothing.
  const known = manifest.retired.find((entry) => entry.tenantId === target.tenantId && entry.domain)
    ?? manifest.retired.find((entry) => entry.domain);
  const knownDetail = known && (await call("GET", `${BASE}/${known.tenantId}`, undefined, token)).json.data;
  if (knownDetail?.isArchived) {
    const person = await signIn(`aicha.bouazizi@${known.domain}`);
    const work = await call("GET", "/api/performance/work", undefined, person.json?.data?.accessToken);
    const core = await call("GET", "/api/corehr/employees/me", undefined, person.json?.data?.accessToken);
    check(
      `Its people reach nothing (${known.domain})`,
      work.status === 401 && core.status === 401 && work.json?.reason === "tenant-inactive",
      `performance ${work.status} ${work.json?.reason}, corehr ${core.status}`);
  } else {
    console.log("SKIP  access check: no archived preset tenant with a known domain");
  }

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exitCode = failed ? 1 : 0;
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
