// B-070 slice 6 + B-077 (add-overview-my-team-insights-and-home) API journey, through the shell at http://localhost:3000/api.
//   node .local-docs/agents/data/journey-overview-team-insights.cjs
// Read-only: Overview rows for an employee (Aicha), a manager (Mariam) and HR (Amira); upcoming moments for each;
// My Team's phase groups without the caller; released team results (Omar reviewed Adel Brahim, released by
// journey-calibration.cjs) and nothing before release (Mariam); Insights and a drill-through as HR; 403 for a manager.
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

let failed = 0;
const data = (r) => r.json?.data ?? r.json;
const check = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};
const kinds = (overview) => (overview?.rows ?? []).map((row) => row.kind);

(async () => {
  const aicha = await login("aicha.bouazizi@example.test");
  const mariam = await login("mariam.gharbi@example.test");
  const amira = await login("amira.khelifi@example.test");
  const omar = await login("omar.mansour@example.test");

  // 1. Overview: one year and rows by responsibility, in the server's order.
  const employee = data(await call("GET", "/api/performance/overview", null, aicha));
  check("Aicha's Overview names the year and its phase", Boolean(employee?.year?.phases?.length) && Boolean(employee?.year?.currentPhase), employee?.year?.currentPhase);
  check("Aicha sees her own review and plan, no team or cycle row",
    kinds(employee).includes("ownReview") && !kinds(employee).includes("team") && !kinds(employee).includes("cycle"), kinds(employee).join(", "));

  const manager = data(await call("GET", "/api/performance/overview", null, mariam));
  check("Mariam sees the reviews she writes and no cycle row", kinds(manager).includes("reviewsYouWrite") && !kinds(manager).includes("cycle"), kinds(manager).join(", "));
  const writes = manager?.rows?.find((row) => row.kind === "reviewsYouWrite");
  check("Mariam's reviews row counts her reviews", (writes?.total ?? 0) > 0, `${writes?.ready} ready of ${writes?.total}`);

  const hr = data(await call("GET", "/api/performance/overview", null, amira));
  check("Amira's Overview leads with the cycle row", kinds(hr)[0] === "cycle", kinds(hr).join(", "));

  // 2. Upcoming moments for the home agenda.
  for (const [who, token] of [["Aicha", aicha], ["Mariam", mariam], ["Amira", amira]]) {
    const upcoming = await call("GET", "/api/performance/upcoming?days=14", null, token);
    const items = data(upcoming) ?? [];
    check(`${who}'s upcoming moments are dated Performance entries`, upcoming.status === 200 && items.every((i) => i.module && i.date && i.href),
      `${items.length} in 14 days`);
  }
  check("Upcoming refuses a window over 31 days", (await call("GET", "/api/performance/upcoming?days=40", null, mariam)).status === 400);

  // 3. My Team: the phase's groups, never the caller.
  const roster = data(await call("GET", `/api/performance/cycles/${CYCLE}/team/people?filter=All&page=1&pageSize=25`, null, mariam));
  check("Mariam's My Team is in the Review phase with its groups", roster?.phase === "Review" && roster.groups?.length > 0,
    (roster?.groups ?? []).map((g) => `${g.key} ${g.count}`).join(", "));
  check("Mariam isn't one of her own people", !(roster?.items ?? []).some((m) => /Mariam Gharbi/.test(m.employeeName ?? "")), `${roster?.totalCount} people`);
  check("Each of Mariam's people carries their review facts", (roster?.items ?? []).filter((m) => m.group !== "notInRound").every((m) => m.facts?.review));

  // 4. Team results: only after release, only the caller's team.
  const before = data(await call("GET", `/api/performance/cycles/${CYCLE}/team/results`, null, mariam));
  check("Before release Mariam's team results are empty", before?.released === 0 && (before?.levels ?? []).length === 0);
  const after = data(await call("GET", `/api/performance/cycles/${CYCLE}/team/results`, null, omar));
  const names = (after?.levels ?? []).flatMap((l) => l.people.map((p) => p.name));
  check("Omar's released team results count Adel Brahim at his final level", after?.released >= 1 && names.includes("Adel Brahim"), `${after?.released} released`);
  check("Team results carry no average", !JSON.stringify(after ?? {}).toLowerCase().includes("average"));

  // 5. Insights: administrators only, tenant-scoped, every figure opens its people.
  const insights = await call("GET", `/api/performance/cycles/${CYCLE}/insights`, null, amira);
  const all = data(insights);
  check("Amira reads Insights for FY2027", insights.status === 200 && all?.total?.people > 0, `${all?.total?.people} participants, ${all?.byUnit?.length} units`);
  check("Insights shows the review sections while the round runs", all?.showsReviews === true && Array.isArray(all?.byManager));
  check("Units are ordered with the most late reviews first",
    (all?.byUnit ?? []).every((u, i, list) => i === 0 || (list[i - 1].late ?? 0) >= (u.late ?? 0)));
  const unit = all?.units?.find((u) => u.depth > 0) ?? all?.units?.[0];
  const scoped = data(await call("GET", `/api/performance/cycles/${CYCLE}/insights?unitId=${unit?.unitId}`, null, amira));
  check(`Filtering to ${unit?.name} counts only its people`, scoped?.unitId === unit?.unitId && scoped.total.people <= all.total.people,
    `${scoped?.total?.people} of ${all?.total?.people}`);
  const drill = await call("GET", `/api/performance/cycles/${CYCLE}/insights/people?metric=reviews&page=1&pageSize=5`, null, amira);
  check("A figure opens the people behind it, paged", drill.status === 200 && data(drill).total === all?.total?.reviews && data(drill).items.length <= 5,
    `${data(drill)?.total} people`);
  check("An unknown figure is refused", (await call("GET", `/api/performance/cycles/${CYCLE}/insights/people?metric=average`, null, amira)).status === 400);
  check("A manager without administration gets 403", (await call("GET", `/api/performance/cycles/${CYCLE}/insights`, null, mariam)).status === 403);
  check("Another tenant's or an unknown cycle is 404",
    (await call("GET", "/api/performance/cycles/00000000-0000-0000-0000-000000000001/insights", null, amira)).status === 404);

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
