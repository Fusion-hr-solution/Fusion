// B-087 API journey: the reads the redesigned slice 3 surfaces use, through the shell like the browser. Read-only.
// Run after seed-conversations.cjs and journey-conversations.cjs.
//   node .local-docs/agents/data/journey-conversations-redesign.cjs
const path = require("path");
const { call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  return ok;
}

(async () => {
  const [mariam, aicha, leila, khaled] = await Promise.all(
    ["mariam.gharbi", "aicha.bouazizi", "leila.baccouche", "khaled.sassi"].map((who) => login(`${who}@example.test`)));

  // 1. Mariam's workspace rows carry the next meeting, its agenda, the last held meeting and the rhythm.
  const list = (await call("GET", "/api/performance/one-on-ones", null, mariam)).json.data;
  const row = list.reports.find((r) => r.with.displayName.startsWith("Aicha"));
  check("1. Aicha's row has the next meeting id and agenda count", Boolean(row?.nextMeetingId) && row.agendaCount >= 1, `agenda ${row?.agendaCount}`);
  check("   and the last held meeting and the rhythm", Boolean(row?.lastMetAt) && row.recent.some((b) => b.state === "Completed") && row.recent.some((b) => b.state === "Upcoming"),
    row?.recent.map((b) => b.state).join(","));
  check("   and the actions Mariam owes carry the other person", Array.isArray(list.myActions) && list.myActions.every((a) => a.with?.displayName),
    `${list.myActions.length} owed`);

  // 2. Start options: offered for a report without a series, refused for an existing pair and outside the line.
  const open = list.startWithReports[0]?.with;
  if (open) {
    const start = await call("GET", `/api/performance/one-on-ones/start?with=${open.employeeId}`, null, mariam);
    check(`2. Start options for ${open.displayName}`, start.status === 200 && Array.isArray(start.json.data.suggestions),
      `${start.json?.data?.suggestions?.length} suggestions, ${start.json?.data?.defaultCadence}`);
  } else {
    check("2. Start options (no report without a series to try)", true, "skipped");
  }
  const again = await call("GET", `/api/performance/one-on-ones/start?with=${row.with.employeeId}`, null, mariam);
  check("   an existing pair conflicts", again.status === 409, String(again.status));
  const leilaSelf = (await call("GET", "/api/corehr/workforce/me", null, leila)).json.data.employee;
  const outside = await call("GET", `/api/performance/one-on-ones/start?with=${leilaSelf.employeeId ?? leilaSelf.id}`, null, aicha);
  check("   someone outside the line is refused", outside.status === 400, String(outside.status));

  // 3. Aicha's feedback summary counts what she may read and what waits on her.
  const summary = (await call("GET", "/api/performance/feedback/summary", null, aicha)).json.data;
  const khaledSelf = (await call("GET", "/api/corehr/workforce/me", null, khaled)).json.data.employee;
  const khaledId = khaledSelf.employeeId ?? khaledSelf.id;
  check("3. Aicha's summary counts shared feedback", summary.received >= 1, `${summary.received} from ${summary.fromCount}`);
  check("   never Khaled's manager-only feedback", !summary.from.some((p) => p.id === khaledId));
  check("   and Leila's request waits on her", summary.toAnswer >= 1, `${summary.toAnswer} to answer`);
  check("   with objectives to ask about", Array.isArray(summary.askAbout), summary.askAbout.map((a) => `${a.title}:${a.feedback}`).join(", "));

  // 4. Request rows: the requester sees who answered and the latest answer; an invitee sees neither.
  const mine = (await call("GET", "/api/performance/feedback/requests", null, leila)).json.data.mine[0];
  check("4. Leila's request row lists invitees and the latest answer", (mine?.invitees?.length ?? 0) >= 2 && Boolean(mine?.latestAnswer),
    mine?.invitees?.map((i) => `${i.person.name}:${i.status}`).join(", "));
  const asked = (await call("GET", "/api/performance/feedback/requests", null, aicha)).json.data.toAnswer.find((r) => r.id === mine?.id);
  check("   Aicha's row of it carries neither", asked && asked.invitees === null && asked.latestAnswer === null);

  // 5. Praise summary: what the company celebrated, and Leila's own counts.
  const praise = (await call("GET", "/api/performance/praise/summary", null, leila)).json.data;
  check("5. Praise summary counts values over 90 days", praise.windowDays === 90 && praise.values.length > 0,
    praise.values.map((v) => `${v.name}:${v.count}`).join(", "));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
