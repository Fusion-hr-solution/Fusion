// B-078 (unify-fusion-sidebar) API journey, through the shell at http://localhost:3000/api.
//   node .local-docs/agents/data/journey-unify-fusion-sidebar.cjs
// Work items carry the sidebar section they count under; the person's own card names their job; any member reads
// their tenant's name; an account without an employee gets 404. The first run invites one tenant administrator
// with no employee record (sidebar.admin@example.test) through the Administrators invite flow; later runs reuse it.
const path = require("path");
const { call, login, inviteToken, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

let failed = 0;
const data = (r) => r.json?.data;
const check = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const PERFORMANCE_SECTIONS = ["/performance/plan", "/performance/team", "/performance/one-on-ones", "/performance/feedback", "/performance/reviews", "/performance/cycle"];
const CORE_SECTIONS = ["/core/organization", "/core/people", "/core/workforce-access"];
const ADMIN = "sidebar.admin@example.test";

(async () => {
  const mariam = await login("mariam.gharbi@example.test");
  const amira = await login("amira.khelifi@example.test");
  const aicha = await login("aicha.bouazizi@example.test");

  // 1. Every Performance item names a section of Performance's navigation; a plan decision counts under My Team.
  let seen = 0;
  for (const [who, token] of [["Mariam", mariam], ["Amira", amira], ["Aicha", aicha]]) {
    const items = data(await call("GET", "/api/performance/work", null, token)) ?? [];
    seen += items.length;
    const off = items.filter((item) => !PERFORMANCE_SECTIONS.includes(item.section));
    check(`${who}'s ${items.length} Performance items each name a Performance section`, off.length === 0,
      [...new Set(items.map((i) => `${i.kind}→${i.section}`))].join(", ") || "none today");
  }
  check("The three people have Performance work to check", seen > 0, `${seen} item(s)`);
  const mariamWork = data(await call("GET", "/api/performance/work", null, mariam)) ?? [];
  const toTeam = mariamWork.filter((i) => ["plan-decision", "objective-status"].includes(i.kind));
  check("Mariam's plan decisions and flagged objectives count under /performance/team",
    toTeam.every((i) => i.section === "/performance/team"), `${toTeam.length} item(s)`);
  const toReviews = mariamWork.filter((i) => /assessment|peer|summary|calibration|finalize|acknowledge/.test(i.kind));
  check("Mariam's review work counts under /performance/reviews", toReviews.every((i) => i.section === "/performance/reviews"),
    `${toReviews.length} item(s)`);

  // 2. Core HR items name Core sections (Amira administers access).
  const coreWork = data(await call("GET", "/api/corehr/work", null, amira)) ?? [];
  check("Amira's Core HR items each name a Core section", coreWork.every((i) => CORE_SECTIONS.includes(i.section)),
    coreWork.map((i) => `${i.kind}→${i.section}`).join(", ") || "none");

  // 3. The card names the person's own job, as of today.
  const card = await call("GET", "/api/corehr/me/card", null, mariam);
  check("Mariam's card: VP, Product in Engineering A Core", card.status === 200 && data(card)?.jobTitle === "VP, Product"
    && data(card)?.displayName === "Mariam Gharbi", JSON.stringify(data(card)));
  const amiraCard = data(await call("GET", "/api/corehr/me/card", null, amira));
  check("Amira's card is her own", amiraCard?.displayName === "Amira Khelifi", JSON.stringify(amiraCard));

  // 4. Any member reads their own tenant's name for the brand line (it was administrators only).
  const tenant = await call("GET", "/api/identity/tenant-context/tenant-summary", null, aicha);
  check("Aicha (employee) reads her tenant's name", tenant.status === 200 && data(tenant)?.name === "Carthage Digital Group",
    `${tenant.status} ${data(tenant)?.name}`);

  // 5. Without a session: 401 for both.
  check("The card without a session is 401", (await call("GET", "/api/corehr/me/card")).status === 401);
  check("The tenant summary without a session is 401", (await call("GET", "/api/identity/tenant-context/tenant-summary")).status === 401);

  // 6. A tenant administrator with no employee record: 404 for the card, the tenant name still reads.
  let admin;
  try {
    admin = await login(ADMIN);
  } catch {
    const invited = await call("POST", "/api/identity/tenant-access/invitations", { email: ADMIN }, amira);
    check("Amira invites a tenant administrator without an employee record", invited.status < 300, `${invited.status}`);
    const { token } = await inviteToken(ADMIN);
    const accepted = await call("POST", "/api/identity/tenant-access/invitations/accept",
      { credential: token, password: PASSWORD, firstName: "Sidebar", lastName: "Admin" });
    check("They accept the invitation", accepted.status < 300, `${accepted.status} ${JSON.stringify(accepted.json).slice(0, 200)}`);
    admin = await login(ADMIN);
  }
  const adminCard = await call("GET", "/api/corehr/me/card", null, admin);
  check("An administrator without an employee record gets 404 for the card", adminCard.status === 404, `${adminCard.status}`);
  const adminTenant = await call("GET", "/api/identity/tenant-context/tenant-summary", null, admin);
  check("They still read the tenant's name", data(adminTenant)?.name === "Carthage Digital Group", `${adminTenant.status}`);

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
