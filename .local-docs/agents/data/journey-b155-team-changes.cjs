// B-155 API journey, through the shell like the browser:
//   node .local-docs/agents/data/journey-b155-team-changes.cjs
// Amira (HR) moves Leila to Khaled's team three weeks ahead. Leila hears her manager changes (English and French),
// Khaled hears she joins, her old manager hears she leaves, Amira hears nothing; it shows under Upcoming on its date.
// Leila's email arrives with a one-click unsubscribe that turns off only "Team and job changes". Then Amira gives Rim
// the HR Admin role and takes it back: two account mails, no unsubscribe header.
// B-157: cancelling tells Leila and Khaled it's off (not Amira); an edit into a title-only change tells Leila only the new
// change and Khaled that the move is off.
// Re-runnable: it cancels the change, restores Leila's email choice and Rim's roles.
const path = require("path");
const { BASE, MAILPIT, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const data = (r) => r.json?.data;
const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  return ok;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, ms, step = 1000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await sleep(step);
  }
  return null;
}
const feed = async (token, language = "en") =>
  (await (await fetch(`${BASE}/api/corehr/notifications`, { headers: { Authorization: `Bearer ${token}`, "Accept-Language": language } })).json()).data;
async function mailTo(address, subjectPart, since) {
  return waitFor(async () => {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json();
    return list.messages?.find((m) => m.Subject.includes(subjectPart) && new Date(m.Created) >= since) ?? null;
  }, 45000);
}

(async () => {
  const [amira, leila, khaled] = await Promise.all(
    ["amira.khelifi", "leila.baccouche", "khaled.sassi"].map((who) => login(`${who}@example.test`)));
  const me = async (token) => data(await call("GET", "/api/corehr/workforce/me", null, token)).employee;
  const [leilaMe, khaledMe, amiraMe] = [await me(leila), await me(khaled), await me(amira)];
  const startedAt = new Date(Date.now() - 1000);

  check("1. Core HR's feed refuses an anonymous caller", (await fetch(`${BASE}/api/corehr/notifications`)).status === 401);

  const date = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const recorded = await call("POST", `/api/corehr/employees/people/${leilaMe.stableEmployeeKey}/changes/job`,
    { effectiveDate: `${date}T00:00:00Z`, managerEmployeeId: khaledMe.employeeId }, amira);
  if (!check("2. HR records Leila's move to Khaled's team on " + date, recorded.status === 200, `status ${recorded.status}`)) {
    console.log(JSON.stringify(recorded.json).slice(0, 400));
    process.exit(1);
  }
  const change = data(recorded);
  const oldManager = change.details.managerFrom;

  const leilaEn = (await feed(leila)).items.find((n) => n.kind === "ManagerChanged");
  check("3. Leila hears her manager changes, worded with the date", Boolean(leilaEn?.title.startsWith("Your manager will be Khaled Sassi from")),
    leilaEn?.title);
  check("4. ... marked as a team change, opening her profile, naming who recorded it",
    leilaEn?.badge === "team" && leilaEn?.href === "/core/profile" && leilaEn?.context?.startsWith("Recorded by"), leilaEn?.context);
  const leilaFr = (await feed(leila, "fr")).items.find((n) => n.id === leilaEn?.id);
  check("5. ... and reads in French", Boolean(leilaFr?.title.startsWith("Khaled Sassi sera votre responsable")), leilaFr?.title);

  const khaledFeed = await feed(khaled);
  const joining = khaledFeed.items.find((n) => n.kind === "TeamJoining");
  check("6. Khaled hears Leila joins his team", Boolean(joining?.title.startsWith("Leila Baccouche joins your team on")), joining?.title);

  if (oldManager && oldManager.employeeId !== amiraMe.employeeId) {
    console.log(`      (old manager ${oldManager.displayName} has the TeamLeaving row; checked by the relational suite)`);
  }
  const amiraFeed = await feed(amira);
  check("7. Amira, who recorded it, hears nothing about it",
    !amiraFeed.items.some((n) => n.title.includes("Leila Baccouche") && n.kind.startsWith("Team")),
    oldManager ? `old manager: ${oldManager.displayName}` : "Leila had no manager");

  const up = data(await call("GET", "/api/corehr/upcoming?days=31", null, leila));
  const moment = up.find((m) => m.date === date);
  check("8. It shows under Leila's Upcoming on its date", moment?.title === "Khaled Sassi becomes your manager", moment?.title);
  check("9. ... and not in a window that ends before it", data(await call("GET", "/api/corehr/upcoming?days=7", null, leila)).every((m) => m.date !== date));
  check("10. Upcoming refuses a window over 31 days", (await call("GET", "/api/corehr/upcoming?days=60", null, leila)).status === 400);

  const before = khaledFeed.unreadCount;
  const cross = await call("POST", "/api/corehr/notifications/read", { ids: [joining.id] }, leila);
  check("11. Leila can't mark Khaled's notification read", cross.status === 200 && (await feed(khaled)).unreadCount === before);

  const mail = await mailTo("leila.baccouche@example.test", "Khaled Sassi", startedAt);
  if (check("12. Leila's email arrives", Boolean(mail), mail?.Subject)) {
    const headers = await (await fetch(`${MAILPIT}/api/v1/message/${mail.ID}/headers`)).json();
    const unsubscribe = headers["List-Unsubscribe"]?.[0]?.replace(/[<>]/g, "");
    check("13. ... with a one-click unsubscribe for Core HR", Boolean(unsubscribe?.includes("/api/corehr/notifications/unsubscribe?token=")),
      unsubscribe?.slice(0, 70));
    const prefs = data(await call("GET", "/api/corehr/notification-preferences", null, leila));
    const get = await fetch(unsubscribe);
    check("14. A link scanner's GET changes nothing",
      get.status !== 200 && data(await call("GET", "/api/corehr/notification-preferences", null, leila)).groups[0].email === prefs.groups[0].email,
      `GET ${get.status}`);
    check("15. A tampered link is refused", (await fetch(`${unsubscribe.slice(0, -4)}AAAA`, { method: "POST" })).status === 400);
    const post = await fetch(unsubscribe, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
    const after = data(await call("GET", "/api/corehr/notification-preferences", null, leila));
    check("16. The one-click POST turns off team and job change email", post.status === 200 && after.groups[0].email === false);
    check("17. A stale save is refused", (await call("PUT", "/api/corehr/notification-preferences", { expectedVersion: 0, emailOff: [] }, leila)).status === 409);
    check("18. Another module's group can't be set here",
      (await call("PUT", "/api/corehr/notification-preferences", { expectedVersion: after.version, emailOff: ["deadline-reminders"] }, leila)).status === 400);
    const restored = await call("PUT", "/api/corehr/notification-preferences", { expectedVersion: after.version, emailOff: prefs.groups[0].email ? [] : ["team-and-job-changes"] }, leila);
    check("Clean-up: Leila's email choice restored", restored.status === 200);
  }

  check("19. Cancelling the change takes it off Upcoming",
    (await call("POST", `/api/corehr/employees/people/changes/${change.id}/cancel`, null, amira)).status === 204
      && data(await call("GET", "/api/corehr/upcoming?days=31", null, leila)).every((m) => m.date !== date));

  // B-157: a cancelled or edited change tells the people the first one told.
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`)).replace(",", "");
  const cancelledFor = async (token, since) =>
    (await feed(token)).items.filter((n) => n.kind === "ChangeCancelled" && new Date(n.occurredAt) >= since);
  const leilaOff = (await cancelledFor(leila, startedAt))[0];
  check("20. Leila hears her manager change is off, with the date and who cancelled it",
    leilaOff?.title === `Your manager change on ${day} was cancelled` && leilaOff?.context?.startsWith("Cancelled by"),
    `${leilaOff?.title} / ${leilaOff?.context}`);
  const khaledOff = (await cancelledFor(khaled, startedAt))[0];
  check("21. Khaled hears Leila's move to his team is off", khaledOff?.title === `Leila Baccouche's move to your team on ${day} was cancelled`
    && khaledOff?.href === "/core/team", khaledOff?.title);
  check("22. ... and reads it in French", (await feed(khaled, "fr")).items.find((n) => n.id === khaledOff?.id)?.title
    .startsWith("L'arrivée de Leila Baccouche"));
  check("23. Amira, who cancelled it, hears nothing", (await cancelledFor(amira, startedAt)).length === 0);
  check("24. Leila's earlier notification stays as history", (await feed(leila)).items.some((n) => n.id === leilaEn.id));

  const editStart = new Date(Date.now() - 1000);
  const again = data(await call("POST", `/api/corehr/employees/people/${leilaMe.stableEmployeeKey}/changes/job`,
    { effectiveDate: `${date}T00:00:00Z`, managerEmployeeId: khaledMe.employeeId }, amira));
  const editDate = new Date(Date.now() + 22 * 86400000).toISOString().slice(0, 10);
  const edited = await call("PUT", `/api/corehr/employees/people/changes/${again.id}`,
    { job: { effectiveDate: `${editDate}T00:00:00Z`, jobTitle: "Senior Analyst" } }, amira);
  check("25. HR edits it into a title change that keeps Leila's manager", edited.status === 200, `status ${edited.status}`);
  const leilaAfterEdit = (await feed(leila)).items.filter((n) => new Date(n.occurredAt) >= editStart);
  check("26. Leila, told by both, hears only the new change",
    leilaAfterEdit.some((n) => n.kind === "JobChanged") && !leilaAfterEdit.some((n) => n.kind === "ChangeCancelled"),
    leilaAfterEdit.map((n) => n.kind).join(", "));
  check("27. Khaled, told only by the first, hears it's off", (await cancelledFor(khaled, editStart)).length === 1);
  check("Clean-up: the edited change cancelled",
    (await call("POST", `/api/corehr/employees/people/changes/${data(edited).id}/cancel`, null, amira)).status === 204);

  // Identity: account mail when an administrator role is gained or lost.
  const assignments = data(await call("GET", "/api/identity/core-access/assignments", null, amira));
  const rimRow = assignments.find((a) => a.email === "rim.mahjoub@example.test");
  const profiles = data(await call("GET", "/api/identity/core-access/profiles", null, amira));
  const hrAdmin = profiles.find((p) => p.name === "HR Admin");
  const original = rimRow.accessProfiles.map((p) => p.id);
  const roleStart = new Date(Date.now() - 1000);
  if (original.includes(hrAdmin.id)) console.log("      (Rim already holds HR Admin; the journey removes it first)");
  const withAdmin = [...new Set([...original, hrAdmin.id])];
  const without = original.filter((id) => id !== hrAdmin.id);
  check("28. Amira gives Rim the HR Admin role", (await call("PUT", `/api/identity/core-access/assignments/${rimRow.userId}`, { accessProfileIds: without }, amira)).status === 200
    && (await call("PUT", `/api/identity/core-access/assignments/${rimRow.userId}`, { accessProfileIds: withAdmin }, amira)).status === 200);
  const granted = await mailTo("rim.mahjoub@example.test", "HR Admin", roleStart);
  check("29. Rim gets account mail about it", granted?.Subject === "You were given the HR Admin role", granted?.Subject);
  if (granted) {
    const headers = await (await fetch(`${MAILPIT}/api/v1/message/${granted.ID}/headers`)).json();
    check("30. ... which can't be unsubscribed from", !headers["List-Unsubscribe"]);
  }
  check("Clean-up: Rim's roles restored", (await call("PUT", `/api/identity/core-access/assignments/${rimRow.userId}`, { accessProfileIds: original }, amira)).status === 200);
  if (!original.includes(hrAdmin.id)) {
    const removed = await mailTo("rim.mahjoub@example.test", "was removed", roleStart);
    check("31. Losing it is mailed too", removed?.Subject === "Your HR Admin role was removed", removed?.Subject);
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
