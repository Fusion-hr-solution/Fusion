// Slice 5 API journey (walkthrough 10), through the shell at http://localhost:3000/api, in two phases so the screens can
// be taken between them. Runs once per fresh seed-calibration.cjs:
//   node .local-docs/agents/data/screens-calibration.cjs waiting
//   node .local-docs/agents/data/journey-calibration.cjs join        (steps 1-5: checks, the two held reviews come in)
//   node .local-docs/agents/data/screens-calibration.cjs session
//   node .local-docs/agents/data/journey-calibration.cjs finalize    (steps 6-8: finalize, the reviewer, one release)
//   node .local-docs/agents/data/screens-calibration.cjs after
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

let failed = 0;
const data = (r) => r.json?.data;
const code = (r) => r.json?.details?.code ?? null;
const check = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};
const slug = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const emailOf = (name) => { const [first, ...rest] = name.split(" "); return `${slug(first)}.${slug(rest.join(" "))}@example.test`; };

const phase = process.argv[2] ?? "join";

(async () => {
  const tokens = {};
  const as = async (email) => (tokens[email] ??= await login(email));
  const get = async (email, url) => call("GET", url, null, await as(email));
  const amira = "amira.khelifi@example.test", mariam = "mariam.gharbi@example.test", omar = "omar.mansour@example.test";

  const round = data(await get(amira, `/api/performance/cycles/${CYCLE}/review-rounds`)).find((r) => r.name === "Year-end review");
  const calibration = `/api/performance/review-rounds/${round.id}/calibration`;

  let session = data(await get(amira, calibration));
  const people = data(await get(amira, `${calibration}/people`)).groups.flatMap((g) => g.people);
  const changed = people.filter((p) => p.reviewerName === "Omar Mansour" && p.currentRating !== p.originalRating)
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  if (phase === "finalize") return finalizePhase();

  // 1. The open session waits on the two held reviews, listed by manager, and Finalize is refused.
  const waiting = session.header.outstandingByReviewer;
  check("Session waits on 2 reviews", session.header.outstanding === 2, `${session.header.outstanding}`);
  check("Outstanding grouped under Mariam and Omar", ["Mariam Gharbi", "Omar Mansour"].every((n) => waiting.some((g) => g.reviewerName === n)));
  const blocked = await call("POST", `${calibration}/finalize`, { expectedVersion: session.version }, await as(amira));
  check("Finalize refused while reviews are with managers", blocked.status === 409 && code(blocked) === "Calibration.OutstandingReviews", `${blocked.status} ${code(blocked)}`);

  // 2. Facilitators only: a manager without the grant is refused; a reviewer sees no calibration detail yet.
  const asMariam = await get(mariam, calibration);
  check("Mariam (not a facilitator) is refused the session", asMariam.status === 403, `${asMariam.status}`);
  const distribution = data(await get(amira, `${calibration}/distribution`));
  const omarRow = distribution.managers.find((m) => m.reviewerName === "Omar Mansour");
  check("Omar is flagged as rating above the session", omarRow?.lenient === true, `delta ${omarRow?.delta}`);
  check("A changed review of Omar's is in the session", Boolean(changed), changed?.name);
  const duringReview = data(await get(omar, `/api/performance/reviews/${changed.reviewId}`));
  check("Omar sees no calibration detail while the session is open", duringReview.calibration === null);

  // 3. Conflict and restore on one of Amira's people.
  const target = people.find((p) => p.reviewerName === "Amira Khelifi" && p.currentRating === p.originalRating);
  const first = await call("PUT", `${calibration}/subjects/${target.reviewId}`, {
    rating: Math.min(5, target.originalRating + 1), rationale: "Outcomes beat the team's.", discussionState: "NotDiscussed", expectedVersion: target.version }, await as(amira));
  check("Amira raises one of her own team with a reason", first.status === 200, `${first.status}`);
  const stale = await call("PUT", `${calibration}/subjects/${target.reviewId}`, {
    rating: target.originalRating, rationale: null, discussionState: "NotDiscussed", expectedVersion: target.version }, await as(amira));
  check("A change from a stale version is refused with the current values", stale.status === 409 && code(stale) === "Calibration.Conflict"
    && stale.json?.details?.extra?.changedBy === "Amira Khelifi", `${stale.status} ${code(stale)}`);
  const restored = await call("PUT", `${calibration}/subjects/${target.reviewId}`, {
    rating: target.originalRating, rationale: null, discussionState: "Discussed", expectedVersion: data(first).version }, await as(amira));
  check("Back to the manager's rating clears the reason", restored.status === 200 && data(restored).rationale === null, `${restored.status}`);
  const noReason = await call("PUT", `${calibration}/subjects/${target.reviewId}`, {
    rating: Math.min(5, target.originalRating + 1), rationale: null, discussionState: "Discussed", expectedVersion: data(restored).version }, await as(amira));
  check("A changed rating without a reason is refused", noReason.status === 400, `${noReason.status}`);

  // 4. AI: Mariam drafts Aicha's summary; the held person starts their self-reflection. Unavailable AI is refused quietly.
  const aichaRow = data(await get(mariam, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).toWrite.find((r) => r.subjectDisplayName === "Aicha Bouazizi");
  const draft = await call("POST", `/api/performance/reviews/${aichaRow.reviewId}/draft`, { kind: "Summary" }, await as(mariam));
  check("Mariam's draft is a draft, an abstention or quietly unavailable", draft.status === 200 || draft.status === 503,
    `${draft.status} ${data(draft)?.outcome ?? code(draft)}`);
  if (draft.status === 200 && data(draft).outcome === "Drafted")
    check("Every drafted sentence cites a source", data(draft).sentences.every((s) => s.sources.length > 0));
  const hrDraft = await call("POST", `/api/performance/reviews/${aichaRow.reviewId}/draft`, { kind: "Summary" }, await as(amira));
  check("HR can't draft someone else's review", hrDraft.status === 404, `${hrDraft.status}`);
  const held = waiting.find((g) => g.reviewerName === "Omar Mansour").people[0];
  const heldEmail = emailOf(held);
  const heldOwn = data(await get(heldEmail, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).own;
  const starter = await call("POST", `/api/performance/reviews/${heldOwn.reviewId}/draft`, { kind: "Summary" }, await as(heldEmail));
  check(`${held}'s starter answers from what they may see`, starter.status === 200 || starter.status === 503, `${starter.status}`);
  if (starter.status === 200) check("The starter cites nothing private", data(starter).privateSentenceCount === 0);

  // 5. The two held reviews come in and join the session.
  let heldReview = data(await get(heldEmail, `/api/performance/reviews/${heldOwn.reviewId}`));
  const self = await call("POST", `/api/performance/reviews/${heldReview.id}/self-assessment`, {
    expectedVersion: heldReview.version, summary: "A year of steady delivery.", overallRating: 4,
    items: heldReview.items.map((i) => ({ kind: i.kind, itemId: i.itemId, rating: 4, ...(i.kind === "Objective" ? { reflection: "Delivered." } : {}) })),
    answers: heldReview.questions.filter((q) => q.audience === "Person").map((q) => ({ questionId: q.questionId, text: "Shipping on time." })),
  }, await as(heldEmail));
  check(`${held} submits their self-assessment`, self.status === 200, `${self.status}`);
  for (const [writer, reviewId, rating] of [[omar, heldOwn.reviewId, 5], [mariam, aichaRow.reviewId, 4]]) {
    const review = data(await get(writer, `/api/performance/reviews/${reviewId}`));
    const submit = await call("POST", `/api/performance/reviews/${reviewId}/manager-assessment`, {
      expectedVersion: review.version, summary: "Testing became something the team relies on.", overallRating: rating, potential: "Growing",
      items: review.items.map((i) => ({ kind: i.kind, itemId: i.itemId, rating, assessment: "Consistent." })),
      answers: review.questions.filter((q) => q.audience === "Manager").map((q) => ({ questionId: q.questionId, text: "Keep owning releases." })),
    }, await as(writer));
    check(`${review.reviewerDisplayName} submits ${review.subjectDisplayName}'s review`, submit.status === 200, `${submit.status} ${code(submit) ?? ""}`);
  }
  session = data(await get(amira, calibration));
  check("Both late reviews joined; nothing is with managers", session.header.outstanding === 0, `${session.header.outstanding}`);
  return done();

  async function finalizePhase() {
  // 6. Finalize, with the preview first.
  const preview = data(await get(amira, `${calibration}/finalize-preview`));
  check("The preview counts changes and names flagged people not discussed", preview.ratingsDown >= 2 && Array.isArray(preview.flaggedNotDiscussed),
    `down ${preview.ratingsDown}, up ${preview.ratingsUp}, flagged ${preview.flaggedNotDiscussed.length}`);
  const finalize = await call("POST", `${calibration}/finalize`, { expectedVersion: session.version }, await as(amira));
  check("Amira finalizes the session", finalize.status === 200, `${finalize.status} ${code(finalize) ?? ""}`);
  const changes = data(await get(amira, `${calibration}/changes`));
  check("Every change is listed with its reason", changes.changes.length >= 3 && changes.changes.every((c) => c.reason), `${changes.changes.length}`);

  // 7. The reviewer: outcome and reason, a work item, a notice; only the summary reopens.
  const outcome = data(await get(omar, `/api/performance/reviews/${changed.reviewId}`));
  check("Omar sees the final rating and the reason", outcome.calibration?.calibratedRating === changed.currentRating && Boolean(outcome.calibration?.rationale));
  check("Omar may revise the summary", outcome.calibration?.canReviseSummary === true);
  const work = data(await get(omar, "/api/performance/work"));
  check("Omar has a summary to check", work.some((w) => w.kind === "check-review-summary"));
  const bell = data(await get(omar, "/api/performance/notifications"));
  check("Omar was told calibration finished", bell.items.some((n) => n.title === "Calibration finished"));
  const revise = await call("PUT", `/api/performance/reviews/${changed.reviewId}/manager-summary`,
    { summary: "Strong delivery all year; the main objective moves to next year.", expectedVersion: outcome.version }, await as(omar));
  check("Omar revises the summary", revise.status === 200, `${revise.status} ${code(revise) ?? ""}`);
  check("The work item clears", !data(await get(omar, "/api/performance/work")).some((w) => w.kind === "check-review-summary" && w.id.includes(changed.reviewId)));
  const other = people.find((p) => p.reviewerName === "Omar Mansour" && p.currentRating === p.originalRating && p.currentPotential === p.originalPotential);
  const unchanged = await call("PUT", `/api/performance/reviews/${other.reviewId}/manager-summary`, { summary: "New words.", expectedVersion: 0 }, await as(omar));
  check("An unchanged review doesn't reopen", unchanged.status === 409, `${unchanged.status}`);

  // 8. The person: nothing before release; afterwards the result and summary, never calibration or potential.
  const subjectEmail = emailOf(changed.name);
  let own = data(await get(subjectEmail, `/api/performance/reviews/${changed.reviewId}`));
  check(`${changed.name} sees no rating before release`, own.finalRating === null && own.calibration === null && own.potential === null);
  const latest = data(await get(amira, `/api/performance/reviews/${changed.reviewId}`));
  const release = await call("POST", `/api/performance/reviews/${changed.reviewId}/finalize`, { expectedVersion: latest.version }, await as(amira));
  check("Amira releases the review", release.status === 200, `${release.status} ${code(release) ?? ""}`);
  own = data(await get(subjectEmail, `/api/performance/reviews/${changed.reviewId}`));
  check(`${changed.name} sees the final rating and the revised summary, nothing else`, own.finalRating === changed.currentRating
    && own.managerAssessment?.summary?.startsWith("Strong delivery") && own.calibration === null && own.potential === null);
  const late = await call("PUT", `/api/performance/reviews/${changed.reviewId}/manager-summary`, { summary: "Too late.", expectedVersion: own.version }, await as(omar));
  check("After release the summary is locked", late.status === 409, `${late.status}`);

  return done();
  }

  function done() {
    console.log(failed ? `${failed} check(s) failed` : `Journey ${phase} complete`);
    process.exit(failed ? 1 : 0);
  }
})().catch((error) => { console.error(error); process.exit(1); });
