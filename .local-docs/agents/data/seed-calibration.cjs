// Slice 5 demo data: the Year-end review's calibration session on Carthage, through the product API (run after
// seed-reviews.cjs, whose round has calibration on and holds the teams of Amira, Mariam and Omar).
//   - Every person in the round without an account is activated through the invite flow, then self-assesses, except
//     the last of Omar's team alphabetically, who stays in self-assessment (the starter, board 16).
//   - Each manager writes their reviews: Omar rates high, Amira lower, Mariam in between, so the session has
//     leniency flags; potential varies. Mariam leaves Aicha's review to write (the AI draft, board 12), so the session
//     waits on two reviews (board 02) until journey-calibration.cjs brings them in.
//   - Amira opens the session (she holds the calibrate grant), lowers two of Omar's top ratings and raises one
//     potential, each with a reason, and marks a few people discussed. The session stays open for the walkthrough.
// Idempotent: every step checks the current state first, so a second run changes nothing.
//   node .local-docs/agents/data/seed-calibration.cjs
const path = require("path");
const { BASE, PASSWORD, call, login, inviteToken } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const ROUND = "Year-end review";
const data = (r) => r.json?.data;
let failed = 0;
const step = (label, r, ok = r.status < 300) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (${r.status}${ok ? "" : ` ${r.json?.details?.code ?? ""} ${r.json?.errors?.[0] ?? ""}`})`);
  return data(r);
};
const skip = (label) => console.log(`SKIP  ${label}  (already done)`);
const slug = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const emailOf = (name) => {
  const [first, ...rest] = name.split(" ");
  return `${slug(first)}.${slug(rest.join(" "))}@example.test`;
};

// What each manager tends to give: Omar high, Amira low, Mariam in between. Indexed by the person's place in the team.
const RATINGS = { "Omar Mansour": [5, 5, 4, 5, 4, 5, 4, 5], "Amira Khelifi": [3, 2, 3, 3, 2, 3, 4, 3], "Mariam Gharbi": [4, 3, 4, 3, 5, 4, 3, 4] };
const POTENTIALS = ["Growing", "High", "Developing", "Growing", "High", "Growing", "Developing", "Growing"];
const SUMMARIES = [
  "A year of steady delivery, with the hardest objective still open.",
  "Carried the team through a difficult release and rebuilt trust with the client.",
  "Met the role across the year; the second half was stronger than the first.",
];

(async () => {
  const tokens = {};
  const token = async (email) => (tokens[email] ??= await login(email));
  const amira = await token("amira.khelifi@example.test");
  const get = async (email, url) => data(await call("GET", url, null, await token(email)));

  const round = (await get("amira.khelifi@example.test", `/api/performance/cycles/${CYCLE}/review-rounds`)).find((r) => r.name === ROUND);
  if (!round) throw new Error("Run seed-reviews.cjs first: no Year-end review.");
  const detail = await get("amira.khelifi@example.test", `/api/performance/review-rounds/${round.id}`);
  if (!detail.frozenConfiguration?.calibration && !detail.calibrationEnabled) throw new Error("The Year-end review runs without calibration; rebuild with the current seed-reviews.cjs.");

  // 1. Accounts for everyone in the round, so each can self-assess.
  const people = detail.subjects.filter((s) => !s.isExcluded);
  for (const person of people) {
    const email = emailOf(person.subjectDisplayName);
    try { await token(email); continue; } catch { /* no account yet */ }
    const activation = await call("POST", `/api/corehr/workforce/access-subjects/${person.subjectEmployeeId}/activate`,
      { employeeId: person.subjectEmployeeId, baseline: "Employee", expectedVersion: 0 }, amira);
    if (activation.status >= 300) { step(`Activate ${person.subjectDisplayName}`, activation); continue; }
    const invitation = await inviteToken(email);
    const [first, ...rest] = person.subjectDisplayName.split(" ");
    const accept = await fetch(`${BASE}/api/identity/invites/${encodeURIComponent(invitation.token)}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: first, lastName: rest.join(" "), password: PASSWORD }),
    });
    step(`${person.subjectDisplayName} activated`, { status: accept.status, json: null });
  }

  // 2. Self-assessments; one of Omar's people is left writing.
  const holdSelf = people.filter((p) => p.reviewerDisplayName === "Omar Mansour").map((p) => p.subjectDisplayName).sort().at(-1);
  for (const person of people) {
    if (person.subjectDisplayName === holdSelf) { console.log(`HOLD  ${holdSelf} keeps writing their self-assessment`); continue; }
    const email = emailOf(person.subjectDisplayName);
    const own = (await get(email, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).own;
    if (!own) { console.log(`NOTE  ${person.subjectDisplayName} has no review in the round`); continue; }
    const review = await get(email, `/api/performance/reviews/${own.reviewId}`);
    if (!review.canEditSelfAssessment) { skip(`${person.subjectDisplayName}'s self-assessment`); continue; }
    step(`${person.subjectDisplayName} self-assesses`, await call("POST", `/api/performance/reviews/${review.id}/self-assessment`, {
      expectedVersion: review.version, summary: "Most of what I set out to do landed; one objective moves to next year.", overallRating: 4,
      items: review.items.map((item) => ({ kind: item.kind, itemId: item.itemId, rating: 4,
        ...(item.kind === "Objective" ? { reflection: "Delivered the main milestones; the last one waits on another team." } : {}) })),
      answers: review.questions.filter((q) => q.audience === "Person").map((q) => ({ questionId: q.questionId, text: "Taking a release from plan to production." })),
    }, await token(email)));
  }

  // 3. Manager assessments, with each manager's tendency.
  for (const manager of ["Omar Mansour", "Amira Khelifi", "Mariam Gharbi"]) {
    const email = emailOf(manager);
    const rows = (await get(email, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).toWrite
      .sort((a, b) => a.subjectDisplayName.localeCompare(b.subjectDisplayName));
    for (const [index, row] of rows.entries()) {
      if (manager === "Mariam Gharbi" && row.subjectDisplayName === "Aicha Bouazizi") { console.log("HOLD  Mariam keeps Aicha's review to write"); continue; }
      const review = await get(email, `/api/performance/reviews/${row.reviewId}`);
      if (!review.canEditManagerAssessment) { skip(`${manager} on ${row.subjectDisplayName} (${review.state})`); continue; }
      const rating = RATINGS[manager][index % RATINGS[manager].length];
      step(`${manager} rates ${row.subjectDisplayName} ${rating}`, await call("POST", `/api/performance/reviews/${review.id}/manager-assessment`, {
        expectedVersion: review.version, summary: SUMMARIES[index % SUMMARIES.length], overallRating: rating,
        potential: review.potentialEnabled ? POTENTIALS[index % POTENTIALS.length] : null,
        items: review.items.map((item) => ({ kind: item.kind, itemId: item.itemId, rating, assessment: "Consistent across the year." })),
        answers: review.questions.filter((q) => q.audience === "Manager").map((q) => ({ questionId: q.questionId, text: "Keep owning releases end to end." })),
      }, await token(email)));
    }
  }

  // 4. The session: Amira opens it, changes three people with reasons, marks a few discussed.
  const calibration = `/api/performance/review-rounds/${round.id}/calibration`;
  let session = await call("GET", calibration, null, amira);
  if (session.status === 404) session = { json: { data: step("Amira opens the calibration session", await call("POST", calibration, null, amira)) } };
  else skip("Calibration session open");
  const header = data(await call("GET", calibration, null, amira));
  if (header?.state !== "Open") { skip(`Session is ${header?.state}`); return done(); }
  const groups = data(await call("GET", `${calibration}/people`, null, amira)).groups;
  const everyone = groups.flatMap((group) => group.people);
  const omars = everyone.filter((p) => p.reviewerName === "Omar Mansour" && p.originalRating === 5).sort((a, b) => a.name.localeCompare(b.name));
  const changes = [
    ...omars.slice(0, 2).map((p) => ({ person: p, rating: 4, potential: null, reason: "Strong delivery, but the year's main objective is behind; the group agreed 4 reflects it. Omar agreed in the session." })),
  ];
  const growing = everyone.find((p) => p.reviewerName === "Mariam Gharbi" && p.originalPotential === "Growing");
  if (growing) changes.push({ person: growing, rating: growing.originalRating, potential: "High", reason: "Led the vendor migration alone; ready for a lead role next cycle." });
  for (const change of changes) {
    if (change.person.currentRating !== change.person.originalRating || change.person.currentPotential !== change.person.originalPotential) {
      skip(`${change.person.name} changed`);
      continue;
    }
    step(`Amira changes ${change.person.name}`, await call("PUT", `${calibration}/subjects/${change.person.reviewId}`, {
      rating: change.rating, rationale: change.reason, discussionState: "Discussed", expectedVersion: change.person.version,
      ...(change.potential ? { potential: change.potential } : {}),
    }, amira));
  }
  for (const person of everyone.filter((p) => p.reviewerName === "Amira Khelifi" && !p.discussed).slice(0, 2)) {
    step(`Amira marks ${person.name} discussed`, await call("PUT", `${calibration}/subjects/${person.reviewId}`, {
      rating: person.currentRating, rationale: null, discussionState: "Discussed", expectedVersion: person.version,
    }, amira));
  }
  return done();

  function done() {
    console.log(failed ? `\n${failed} step(s) failed` : "\nSeed complete");
    process.exit(failed ? 1 : 0);
  }
})().catch((error) => { console.error(error); process.exit(1); });
