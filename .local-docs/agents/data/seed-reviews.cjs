// Slice 4 demo data: the FY2027 Year-end review on Carthage, through the product API (run after prepare-carthage-demo.mjs,
// the slice 2a journey, seed-alignment-map.cjs and seed-conversations.cjs). Everything is dated today: the API records
// real time, and a past released round waits for a Development-only seeder (D-40, ask first).
//   - Amira creates and launches "Year-end review" with self-assessment, peer input, objective ratings, every active
//     competency, 3 person + 2 manager + 3 peer questions, potential and calibration (slice 5). The round holds the teams
//     of the three managers with accounts (Amira, Mariam, Omar), so seed-calibration.cjs can take every review through.
//   - Aicha nominates Leila, Khaled and Rim; Mariam approves with a swap (Rim → Omar). Leila answers, Khaled declines,
//     Omar's request stays open. Aicha submits her self-assessment, so Mariam has a review ready to write.
//   - Khaled nominates three colleagues and leaves the list for his reviewer to approve.
//   - Amira moves Sofiene Jebali's self-assessment by three days ("Back from sick leave").
//   - Mariam self-assesses; Amira, her reviewer, writes her review (potential High) and releases it, so Mariam has a
//     released result to acknowledge.
// Idempotent: every step checks the current state first, so a second run changes nothing.
//   node .local-docs/agents/data/seed-reviews.cjs
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
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

(async () => {
  const tokens = {};
  const token = async (who) => (tokens[who] ??= await login(`${who}@example.test`));
  const ids = {};
  const me = async (who) => {
    if (!ids[who]) {
      const self = data(await call("GET", "/api/corehr/workforce/me", null, await token(who))).employee;
      ids[who] = self.employeeId ?? self.id;
    }
    return ids[who];
  };
  const get = async (who, url) => data(await call("GET", url, null, await token(who)));

  // 1. The round: create, configure every component, launch.
  const amira = await token("amira.khelifi");
  let rounds = await get("amira.khelifi", `/api/performance/cycles/${CYCLE}/review-rounds`);
  let summary = rounds.find((r) => r.name === ROUND);
  if (!summary) {
    summary = step("Amira creates the Year-end review", await call("POST", `/api/performance/cycles/${CYCLE}/review-rounds`,
      { name: ROUND, periodStart: "2026-10-01", periodEnd: "2027-08-31" }, amira));
  } else skip("Year-end review exists");
  let round = await get("amira.khelifi", `/api/performance/review-rounds/${summary.id}`);
  if (round.state === "Draft") {
    const library = await get("amira.khelifi", "/api/performance/settings/review-questions");
    const pick = (audience, count) => library.filter((q) => q.audience === audience && q.state === "Active").slice(0, count).map((q) => q.id);
    const competencies = (await get("amira.khelifi", "/api/performance/settings/competencies")).filter((c) => c.state === "Active").map((c) => c.id);
    round = step("Amira turns on every component and picks 8 questions", await call("PUT", `/api/performance/review-rounds/${round.id}`, {
      expectedVersion: round.version, name: ROUND, periodStart: round.periodStart, periodEnd: round.periodEnd,
      selfAssessmentEnabled: true, objectiveRatingsEnabled: true, calibrationEnabled: true,
      selfAssessmentDueDate: null, managerAssessmentDueDate: null, competencyIds: competencies,
      peerInputEnabled: true, questionsEnabled: true, potentialEnabled: true,
      questionIds: [...pick("Person", 3), ...pick("Manager", 2), ...pick("Peer", 3)],
    }, amira));
    // Only the teams of managers who can sign in: every review here must be able to reach calibration through the API.
    const reviewers = new Set([await me("amira.khelifi"), await me("mariam.gharbi"), await me("omar.mansour")]);
    const outside = round.subjects.filter((s) => !s.isExcluded && !reviewers.has(s.reviewerEmployeeId));
    if (outside.length) {
      step(`Amira keeps the round to the three teams (${outside.length} reviewed separately)`, await call("PUT", `/api/performance/review-rounds/${round.id}/population`, {
        expectedVersion: round.version,
        subjects: outside.map((s) => ({ participantId: s.participantId, isExcluded: true, exclusionReason: "Reviewed separately this year", reviewerEmployeeId: s.reviewerEmployeeId })),
      }, amira));
      round = await get("amira.khelifi", `/api/performance/review-rounds/${round.id}`);
    }
    if (!round.readiness?.ready) {
      console.log("Readiness:", JSON.stringify(round.readiness));
      const blocked = round.subjects.filter((s) => s.readinessIssues.length && !s.isExcluded);
      if (blocked.length) {
        step(`Amira leaves out ${blocked.length} people the round can't review`, await call("PUT", `/api/performance/review-rounds/${round.id}/population`, {
          expectedVersion: round.version,
          subjects: blocked.map((s) => ({ participantId: s.participantId, isExcluded: true, exclusionReason: "No active reviewer this cycle", reviewerEmployeeId: s.reviewerEmployeeId })),
        }, amira));
        round = await get("amira.khelifi", `/api/performance/review-rounds/${round.id}`);
      }
    }
    const launched = step("Amira launches the round", await call("POST", `/api/performance/review-rounds/${round.id}/launch`, { expectedVersion: round.version }, amira));
    console.log(`      ${launched?.reviewCount ?? 0} reviews opened`);
  } else skip(`Year-end review is ${round.state}`);

  const review = async (who, reviewId) => get(who, `/api/performance/reviews/${reviewId}`);
  const own = async (who) => (await get(who, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).own;

  // 2. Aicha's peers: nominate, Mariam approves with a swap.
  const aichaOwn = await own("aicha.bouazizi");
  let aicha = await review("aicha.bouazizi", aichaOwn.reviewId);
  if (!aicha.peers?.nominatedAt && aicha.canNominatePeers) {
    step("Aicha nominates Leila, Khaled and Rim", await call("PUT", `/api/performance/reviews/${aicha.id}/peers`, {
      expectedVersion: aicha.version, employeeIds: [await me("leila.baccouche"), await me("khaled.sassi"), await me("rim.mahjoub")],
    }, await token("aicha.bouazizi")));
  } else skip("Aicha's peers nominated");
  let forMariam = await review("mariam.gharbi", aicha.id);
  if (forMariam.canApprovePeers) {
    step("Mariam approves Aicha's list, swapping Rim for Omar", await call("POST", `/api/performance/reviews/${aicha.id}/peers/approve`, {
      expectedVersion: forMariam.version, employeeIds: [await me("leila.baccouche"), await me("khaled.sassi"), await me("omar.mansour")],
    }, await token("mariam.gharbi")));
  } else skip("Aicha's peer list approved");

  // 3. Peer input: Leila answers, Khaled declines, Omar's stays open.
  const requestFor = async (who) => (await get(who, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).askedOfYou
    .find((r) => r.subjectDisplayName.startsWith("Aicha"));
  const leilaAsk = await requestFor("leila.baccouche");
  if (leilaAsk?.state === "Open") {
    const request = await get("leila.baccouche", `/api/performance/peer-requests/${leilaAsk.requestId}`);
    const words = [
      "She turns vague bug reports into tests that fail for the right reason.",
      "Share the dashboard plans earlier; we found out about the vendor delay from the release notes.",
      "Calm in release week. People go to her when the build is red.",
    ];
    step("Leila sends her input for Aicha", await call("POST", `/api/performance/peer-requests/${request.id}/send`, {
      answers: request.questions.map((q, i) => ({ questionId: q.questionId, text: words[i % words.length] })),
    }, await token("leila.baccouche")));
  } else skip("Leila's input sent");
  const khaledAsk = await requestFor("khaled.sassi");
  if (khaledAsk?.state === "Open") {
    step("Khaled declines with a note", await call("POST", `/api/performance/peer-requests/${khaledAsk.requestId}/decline`,
      { note: "Haven't worked with Aicha since March" }, await token("khaled.sassi")));
  } else skip("Khaled's decline");

  // 4. Aicha submits her self-assessment.
  aicha = await review("aicha.bouazizi", aicha.id);
  if (aicha.canEditSelfAssessment) {
    const reflections = [
      "We went from a manual two-day regression pass to a nightly suite. The last UI flows wait on the new design system.",
      "The dashboard is live for two of the four product lines; the vendor API slipped twice.",
      "Steady progress, with the last part moving to next quarter.",
    ];
    step("Aicha submits her self-assessment", await call("POST", `/api/performance/reviews/${aicha.id}/self-assessment`, {
      expectedVersion: aicha.version, summary: "A year where testing became something the team relies on.", overallRating: 4,
      items: aicha.items.map((item, i) => item.kind === "Objective"
        ? { kind: item.kind, itemId: item.itemId, reflection: reflections[i % reflections.length], rating: i === 0 ? 4 : 3 }
        : { kind: item.kind, itemId: item.itemId, rating: 4, comment: i % 2 ? null : "Owned the flaky-test problem end to end." }),
      answers: aicha.questions.filter((q) => q.audience === "Person").map((q, i) => ({ questionId: q.questionId,
        text: ["Getting the payments team to run our suite nightly.", "Vendor dependencies we found out about late.", "Owning a release plan end to end."][i % 3] })),
    }, await token("aicha.bouazizi")));
  } else skip("Aicha's self-assessment submitted");

  // 5. Khaled nominates and leaves the list for his reviewer.
  const khaledOwn = await own("khaled.sassi");
  if (khaledOwn) {
    const khaled = await review("khaled.sassi", khaledOwn.reviewId);
    if (khaled.canNominatePeers && !khaled.peers?.nominatedAt) {
      const options = [await me("leila.baccouche"), await me("rim.mahjoub"), await me("aicha.bouazizi")].filter((id) => id !== khaled.reviewerEmployeeId);
      step(`Khaled nominates ${options.length} colleagues for ${khaled.reviewerDisplayName} to approve`, await call("PUT", `/api/performance/reviews/${khaled.id}/peers`,
        { expectedVersion: khaled.version, employeeIds: options }, await token("khaled.sassi")));
    } else skip("Khaled's nominations");
  }

  // 6. Amira moves Sofiene's self-assessment by three days.
  const mariamWork = await get("mariam.gharbi", `/api/performance/reviews/workspace?cycle=${CYCLE}`);
  const sofieneRow = mariamWork.toWrite.find((r) => r.subjectDisplayName.startsWith("Sofiene"));
  if (sofieneRow) {
    const sofiene = await review("amira.khelifi", sofieneRow.reviewId);
    if (!sofiene.schedule.selfOverridden && sofiene.canMoveDueDate) {
      const to = new Date(`${sofiene.schedule.selfAssessmentDue}T00:00:00Z`);
      to.setUTCDate(to.getUTCDate() + 3);
      step("Amira moves Sofiene's self-assessment by three days", await call("POST", `/api/performance/reviews/${sofiene.id}/due-date`, {
        expectedVersion: sofiene.version, dueDate: to.toISOString().slice(0, 10), reason: "Back from sick leave on Monday",
      }, amira));
    } else skip("Sofiene's due date moved");
  } else console.log("NOTE  Sofiene isn't in Mariam's reviews; no due-date move");

  // 7. Mariam's own review: she self-assesses and Amira writes it; it goes to calibration with the rest.
  const mariamOwn = await own("mariam.gharbi");
  if (mariamOwn) {
    let mariam = await review("mariam.gharbi", mariamOwn.reviewId);
    if (mariam.canEditSelfAssessment) {
      step("Mariam submits her self-assessment", await call("POST", `/api/performance/reviews/${mariam.id}/self-assessment`, {
        expectedVersion: mariam.version, summary: "The team shipped every committed release this year.", overallRating: 4,
        items: mariam.items.map((item) => ({ kind: item.kind, itemId: item.itemId, rating: 4,
          ...(item.kind === "Objective" ? { reflection: "Delivered with the team; the last milestone moves to Q1." } : {}) })),
        answers: mariam.questions.filter((q) => q.audience === "Person").map((q) => ({ questionId: q.questionId, text: "Growing two new leads in the team." })),
      }, await token("mariam.gharbi")));
    } else skip("Mariam's self-assessment");
    let byAmira = await review("amira.khelifi", mariam.id);
    if (byAmira.canEditManagerAssessment) {
      step("Amira writes Mariam's review with potential High", await call("POST", `/api/performance/reviews/${mariam.id}/manager-assessment`, {
        expectedVersion: byAmira.version, summary: "Mariam built a team other managers borrow from. Next year: hand the release calendar to her leads.",
        overallRating: 4, potential: "High",
        items: byAmira.items.map((item) => ({ kind: item.kind, itemId: item.itemId, rating: 4, assessment: "Consistent and well-judged." })),
        answers: byAmira.questions.filter((q) => q.audience === "Manager").map((q, i) => ({ questionId: q.questionId,
          text: ["Coaching new leads in the open.", "Delegating the release calendar."][i % 2] })),
      }, amira));
    } else skip("Mariam's review written");
  }

  console.log(failed ? `\n${failed} step(s) failed` : "\nSeed complete");
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
