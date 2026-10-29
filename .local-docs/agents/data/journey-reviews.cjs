// Slice 4 API journey (walkthroughs 6–11), run after seed-reviews.cjs, through the shell's /api like the browser.
// Uses Omar Mansour's review (reviewed by Amira Khelifi) for a full pass, so it runs once per fresh seed:
//   launch state → a second round blocked by the running one (B-060) → Omar nominates → Amira approves with a swap →
//   Leila answers, Khaled declines → Omar self-assesses → Amira moves Omar's manager date → Amira submits without
//   potential (refused) then with it → Aicha's late answer is refused → release → Omar acknowledges → PDFs by lens →
//   reminder dedupe and peer boundaries.
//   node .local-docs/agents/data/journey-reviews.cjs
const path = require("path");
const { execFileSync } = require("child_process");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const { CYCLE } = require("./carthage-ids.cjs");

const data = (r) => r.json?.data;
let failed = 0;
let passed = 0;
const check = (label, ok, detail = "") => {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  return ok;
};
const code = (r) => `${r.status} ${r.json?.details?.code ?? ""}`.trim();

(async () => {
  const tokens = {};
  const token = async (who) => (tokens[who] ??= await login(`${who}@example.test`));
  const ids = {};
  const me = async (who) => (ids[who] ??= (data(await call("GET", "/api/corehr/workforce/me", null, await token(who))).employee).employeeId);
  const as = async (who, method, url, body) => call(method, url, body ?? null, await token(who));
  const read = async (who, url) => data(await as(who, "GET", url));

  // 1. The running round.
  const rounds = await read("amira.khelifi", `/api/performance/cycles/${CYCLE}/review-rounds`);
  const yearEnd = rounds.find((r) => r.name === "Year-end review");
  const round = await read("amira.khelifi", `/api/performance/review-rounds/${yearEnd.id}`);
  check("1. Year-end review is running with stage totals and teams", round.state === "Active" && round.progress?.teams.length > 0,
    `${round.progress?.stages.map((s) => `${s.stage} ${s.done}/${s.total}`).join(", ")}`);

  // 2. A second round can't launch while it runs (B-060).
  let spot = rounds.find((r) => r.name === "Product launch spot review");
  if (!spot) spot = data(await as("amira.khelifi", "POST", `/api/performance/cycles/${CYCLE}/review-rounds`, { name: "Product launch spot review", periodStart: "2027-06-01", periodEnd: "2027-08-31" }));
  const spotRound = await read("amira.khelifi", `/api/performance/review-rounds/${spot.id}`);
  check("2a. The draft's readiness names the running round", spotRound.readiness?.runningRound?.id === yearEnd.id);
  const blocked = await as("amira.khelifi", "POST", `/api/performance/review-rounds/${spot.id}/launch`, { expectedVersion: spotRound.version });
  check("2b. Launching it is refused with the running round's id and progress", blocked.status === 409
    && blocked.json?.details?.extra?.runningRound?.name === "Year-end review", code(blocked));

  // 3–4. Omar nominates; Amira approves with a swap (Rim → Aicha).
  const omarId = (await read("omar.mansour", `/api/performance/reviews/workspace?cycle=${CYCLE}`)).own.reviewId;
  let omar = await read("omar.mansour", `/api/performance/reviews/${omarId}`);
  const nominated = await as("omar.mansour", "PUT", `/api/performance/reviews/${omarId}/peers`,
    { expectedVersion: omar.version, employeeIds: [await me("leila.baccouche"), await me("khaled.sassi"), await me("rim.mahjoub")] });
  check("3. Omar nominates Leila, Khaled and Rim", nominated.status === 200, code(nominated));
  const amiraWork = await read("amira.khelifi", "/api/performance/work");
  check("3b. Amira has an item to review Omar's list", amiraWork.some((i) => i.kind === "approve-peer-list" && i.href.includes(omarId)));
  const suggestions = await read("amira.khelifi", `/api/performance/reviews/${omarId}/peer-suggestions`);
  check("3c. Suggestions come back for the reviewer", Array.isArray(suggestions), `${suggestions?.length ?? 0} suggested`);
  omar = await read("amira.khelifi", `/api/performance/reviews/${omarId}`);
  const approved = await as("amira.khelifi", "POST", `/api/performance/reviews/${omarId}/peers/approve`,
    { expectedVersion: omar.version, employeeIds: [await me("leila.baccouche"), await me("khaled.sassi"), await me("aicha.bouazizi")] });
  check("4. Amira approves, swapping Rim for Aicha", approved.status === 200 && data(approved).approved, code(approved));
  const rimWork = await read("rim.mahjoub", `/api/performance/reviews/workspace?cycle=${CYCLE}`);
  check("4b. Rim, swapped out, has no request for Omar", !rimWork.askedOfYou.some((r) => r.subjectDisplayName.startsWith("Omar")));

  // 5. Peers: Leila answers, Khaled declines; boundaries hold.
  const requestOf = async (who) => (await read(who, `/api/performance/reviews/workspace?cycle=${CYCLE}`)).askedOfYou.find((r) => r.subjectDisplayName.startsWith("Omar"));
  const leilaAsk = await requestOf("leila.baccouche");
  const leilaRequest = await read("leila.baccouche", `/api/performance/peer-requests/${leilaAsk.requestId}`);
  const empty = await as("leila.baccouche", "POST", `/api/performance/peer-requests/${leilaRequest.id}/send`, { answers: [{ questionId: leilaRequest.questions[0].questionId, text: "Only one" }] });
  check("5a. Sending with a question blank is refused and names it", empty.status === 400 && empty.json?.details?.extra?.questions?.length > 0, code(empty));
  const sent = await as("leila.baccouche", "POST", `/api/performance/peer-requests/${leilaRequest.id}/send`,
    { answers: leilaRequest.questions.map((q) => ({ questionId: q.questionId, text: "Omar makes the platform team easy to work with." })) });
  check("5b. Leila sends her input", sent.status === 200 && data(sent).state === "Answered", code(sent));
  const khaledAsk = await requestOf("khaled.sassi");
  const declined = await as("khaled.sassi", "POST", `/api/performance/peer-requests/${khaledAsk.requestId}/decline`, { note: "Haven't worked with Omar this year" });
  check("5c. Khaled declines with a note", declined.status === 200 && data(declined).state === "Declined", code(declined));
  const notMine = await as("rim.mahjoub", "GET", `/api/performance/peer-requests/${leilaRequest.id}`);
  check("5d. Someone else's peer request is not found", notMine.status === 404, code(notMine));
  const peerOnReview = await as("leila.baccouche", "GET", `/api/performance/reviews/${omarId}`);
  check("5e. A peer can't read the review", peerOnReview.status === 403, code(peerOnReview));

  // 6. Omar self-assesses; he sees who was asked, never answers.
  omar = await read("omar.mansour", `/api/performance/reviews/${omarId}`);
  check("6a. Omar sees who was asked and no answers or states", omar.peers.people.length === 3
    && omar.peers.people.every((p) => p.state === null && p.answers === null) && !JSON.stringify(omar).includes("easy to work with"));
  const missing = await as("omar.mansour", "POST", `/api/performance/reviews/${omarId}/self-assessment`, { expectedVersion: omar.version, summary: "A steady year." });
  check("6b. Submitting without the overall rating or answers is refused and names them", missing.status === 400
    && missing.json?.details?.extra?.overallRating === true, code(missing));
  const selfSubmit = await as("omar.mansour", "POST", `/api/performance/reviews/${omarId}/self-assessment`, {
    expectedVersion: omar.version, summary: "The platform team shipped its migration on time.", overallRating: 3,
    items: omar.items.map((item) => ({ kind: item.kind, itemId: item.itemId, rating: 3, ...(item.kind === "Objective" ? { reflection: "On track." } : {}) })),
    answers: omar.questions.filter((q) => q.audience === "Person").map((q) => ({ questionId: q.questionId, text: "The migration." })),
  });
  check("6c. Omar submits his self-assessment", selfSubmit.status === 200 && data(selfSubmit).state === "ManagerAssessment", code(selfSubmit));

  // 7. Amira moves Omar's manager assessment date; the reviewer can't move their own.
  let forAmira = await read("amira.khelifi", `/api/performance/reviews/${omarId}`);
  const newDate = new Date(`${forAmira.schedule.managerAssessmentDue}T00:00:00Z`);
  newDate.setUTCDate(newDate.getUTCDate() + 2);
  const moved = await as("amira.khelifi", "POST", `/api/performance/reviews/${omarId}/due-date`,
    { expectedVersion: forAmira.version, dueDate: newDate.toISOString().slice(0, 10), reason: "Quarter-end close" });
  check("7a. Amira moves Omar's review date with a reason", moved.status === 200 && data(moved).stage === "ManagerAssessment", code(moved));
  const mariamMove = await as("mariam.gharbi", "POST", `/api/performance/review-rounds/${yearEnd.id}/due-dates`,
    { expectedVersion: round.version, stage: "ManagerAssessment", dueDate: newDate.toISOString().slice(0, 10), reason: "More time" });
  check("7b. A reviewer without round administration can't move dates", mariamMove.status === 403, code(mariamMove));

  // 8. Amira submits: potential is required; peer requests close; a late answer is refused.
  forAmira = await read("amira.khelifi", `/api/performance/reviews/${omarId}`);
  check("8a. Amira reads attributed peer answers and the decline", forAmira.peers.people.some((p) => p.state === "Answered" && p.answers?.length)
    && forAmira.peers.people.some((p) => p.state === "Declined" && p.declineNote));
  const body = {
    expectedVersion: forAmira.version, summary: "Omar's team became the one others lean on.", overallRating: 4,
    items: forAmira.items.map((item) => ({ kind: item.kind, itemId: item.itemId, rating: 4, assessment: "Solid." })),
    answers: forAmira.questions.filter((q) => q.audience === "Manager").map((q) => ({ questionId: q.questionId, text: "Keep mentoring." })),
  };
  const noPotential = await as("amira.khelifi", "POST", `/api/performance/reviews/${omarId}/manager-assessment`, body);
  check("8b. Submitting without potential is refused", noPotential.status === 400 && noPotential.json?.details?.extra?.potential === true, code(noPotential));
  const managerSubmit = await as("amira.khelifi", "POST", `/api/performance/reviews/${omarId}/manager-assessment`, { ...body, potential: "Growing" });
  check("8c. Amira submits with potential", managerSubmit.status === 200 && data(managerSubmit).state === "ReadyToFinalize", code(managerSubmit));
  const aichaAsk = await requestOf("aicha.bouazizi");
  const late = await as("aicha.bouazizi", "POST", `/api/performance/peer-requests/${aichaAsk.requestId}/send`, { answers: [] });
  check("8d. Aicha's unanswered request closed: a late answer is refused", late.status === 409 && late.json?.details?.code === "PeerRequest.Closed", code(late));

  // 9. Release, acknowledgement and PDFs by lens.
  forAmira = await read("amira.khelifi", `/api/performance/reviews/${omarId}`);
  const released = await as("amira.khelifi", "POST", `/api/performance/reviews/${omarId}/finalize`, { expectedVersion: forAmira.version });
  check("9a. Amira releases Omar's review", released.status === 200, code(released));
  omar = await read("omar.mansour", `/api/performance/reviews/${omarId}`);
  check("9b. Omar's released review has no potential and no peer answers", omar.potential === null && omar.potentialEnabled === false
    && !JSON.stringify(omar).includes("easy to work with") && omar.canAcknowledge);
  const omarWork = await read("omar.mansour", "/api/performance/work");
  check("9c. Omar has an item to acknowledge", omarWork.some((i) => i.kind === "acknowledge-result"));
  const ack = await as("omar.mansour", "POST", `/api/performance/reviews/${omarId}/acknowledge`, { comment: "Thanks. Agreed on mentoring." });
  const again = await as("omar.mansour", "POST", `/api/performance/reviews/${omarId}/acknowledge`, { comment: "Changed" });
  check("9d. Omar acknowledges once; a second time returns the first", ack.status === 200 && data(again).comment === "Thanks. Agreed on mentoring.");
  const pdf = async (who) => {
    const response = await fetch(`http://localhost:3000/api/performance/reviews/${omarId}/pdf`, { headers: { Authorization: `Bearer ${await token(who)}` } });
    return { status: response.status, type: response.headers.get("content-type"), size: (await response.arrayBuffer()).byteLength };
  };
  const subjectPdf = await pdf("omar.mansour");
  const hrPdf = await pdf("amira.khelifi");
  const strangerPdf = await pdf("rim.mahjoub");
  check("9e. Omar and Amira download PDFs; a colleague can't", subjectPdf.status === 200 && subjectPdf.type?.includes("pdf") && hrPdf.status === 200 && strangerPdf.status === 403,
    `${subjectPdf.status}/${subjectPdf.size}B, ${hrPdf.status}/${hrPdf.size}B, ${strangerPdf.status}`);
  check("9f. HR's copy carries more than the person's (potential and peer answers)", hrPdf.size > subjectPdf.size);

  // 10. Notifications and reminders.
  const amiraBell = data(await as("amira.khelifi", "GET", "/api/performance/notifications"));
  const kinds = new Set((amiraBell?.items ?? amiraBell ?? []).map((n) => n.kind));
  check("10a. Amira, the reviewer, was told of the nomination, the decline and the acknowledgement", kinds.has("PeersNominated") && kinds.has("PeerDeclined") && kinds.has("ReviewAcknowledged"), [...kinds].join(", "));
  const sql = (query) => execFileSync("pwsh", ["-File", path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/sql.ps1"), "-Database", "performance", "-Csv", query], { encoding: "utf8" });
  const duplicates = sql(`select count(*) from (select "TenantId","DedupeKey" from performance."PerformanceOutboxMessages" where "DedupeKey" like 'Reminder:%' group by 1,2 having count(*) > 1) d`).split(/\r?\n/).map((line) => line.trim()).find((line) => /^\d+$/.test(line));
  check("10b. No reminder was staged twice for the same task and day", duplicates === "0", `${duplicates} duplicates`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
