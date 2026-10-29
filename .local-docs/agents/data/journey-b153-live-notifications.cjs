// B-153 API journey, through the shell like the browser:
//   node .local-docs/agents/data/journey-b153-live-notifications.cjs
// Aicha keeps the live nudge open; Leila praises her; the stream says "changed" within a second; the same notification
// reads in English, French and Arabic; with her account set to French, the email arrives in French on the shared
// layout with a one-click unsubscribe header; the anonymous one-click POST turns off only "Feedback and praise".
// Re-runnable: it puts Aicha's language and email choices back and HR deletes the praise.
const path = require("path");
const crypto = require("crypto");
const { BASE, MAILPIT, call, login } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const data = (r) => r.json?.data;
const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  return ok;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reads the stream in the background and records when each event arrived.
function openStream(token) {
  const controller = new AbortController();
  const events = [];
  const done = (async () => {
    const response = await fetch(`${BASE}/api/performance/notifications/stream`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: controller.signal,
    });
    events.push({ event: `status ${response.status} ${response.headers.get("content-type")}`, at: Date.now() });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done: ended } = await reader.read();
      if (ended) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop();
      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("event:"));
        if (line) events.push({ event: line.slice(6).trim(), at: Date.now() });
      }
    }
  })().catch(() => {});
  return { events, close: () => controller.abort(), done };
}

async function waitFor(predicate, ms, step = 100) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = await predicate();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

(async () => {
  const [aicha, leila, amira] = await Promise.all(
    ["aicha.bouazizi", "leila.baccouche", "amira.khelifi"].map((who) => login(`${who}@example.test`)));
  const aichaId = data(await call("GET", "/api/corehr/workforce/me", null, aicha)).employee.employeeId;
  const startLanguage = data(await call("GET", "/api/identity/auth/me", null, aicha))?.language ?? "en";
  const prefs = data(await call("GET", "/api/performance/notification-preferences", null, aicha));
  const startEmailOff = prefs.groups.filter((g) => !g.email && !g.locked).map((g) => g.key);
  const aichaEmail = prefs.emailAddress;

  // 1. Unauthenticated streams are refused at the gateway.
  check("1. The stream refuses an anonymous caller", (await fetch(`${BASE}/api/performance/notifications/stream`)).status === 401);

  // 2. Aicha's account reads French, so the email should be French.
  const setFr = await call("PUT", "/api/identity/account/language", { language: "fr" }, aicha);
  check("2. Aicha's account language set to French", setFr.status === 200);

  const stream = openStream(aicha);
  const ready = await waitFor(() => stream.events.find((e) => e.event === "ready"), 15000);
  check("3. The stream opens through the shell and says ready", Boolean(ready), stream.events.map((e) => e.event).join(", "));

  // 4. Leila praises Aicha: Aicha's open tab hears about it at once.
  const values = data(await call("GET", "/api/performance/values", null, leila));
  const praiseId = crypto.randomUUID();
  const before = Date.now();
  const given = await call("POST", "/api/performance/praise", {
    id: praiseId, recipientEmployeeIds: [aichaId], competencyId: values[0].id, message: "B-153 journey: thank you for the release notes.",
  }, leila);
  check("4. Leila praises Aicha", given.status === 200, `${given.status}`);
  const changed = await waitFor(() => stream.events.find((e) => e.event === "changed" && e.at >= before), 10000, 20);
  check("4. Aicha's stream says changed", Boolean(changed), changed ? `${changed.at - before} ms after the request started` : "none");

  // 5. The same notification in three languages.
  const titleIn = async (language) => {
    const r = await fetch(`${BASE}/api/performance/notifications`, { headers: { Authorization: `Bearer ${aicha}`, "Accept-Language": language } });
    const items = (await r.json()).data.items;
    return items.find((n) => n.href.includes(praiseId));
  };
  const en = await titleIn("en"); const fr = await titleIn("fr"); const ar = await titleIn("ar");
  check("5. English", en?.title?.includes("praised you for"), en?.title);
  check("5. French", fr?.title?.includes("vous a félicité pour"), fr?.title);
  check("5. Arabic", ar?.title?.includes("أشاد بك"), ar?.title);

  // 6. Reading it nudges the stream too, so other tabs clear their dot.
  const beforeRead = Date.now();
  await call("POST", "/api/performance/notifications/read", { ids: [en.id] }, aicha);
  const readNudge = await waitFor(() => stream.events.find((e) => e.event === "changed" && e.at >= beforeRead), 5000, 20);
  check("6. Marking it read nudges the stream", Boolean(readNudge));

  // 7. The email: French, shared layout, one-click unsubscribe (the outbox runs every 15 seconds).
  const mail = await waitFor(async () => {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${aichaEmail}`)}`)).json();
    const found = list.messages?.find((m) => new Date(m.Created).getTime() >= before - 2000);
    return found ? (await fetch(`${MAILPIT}/api/v1/message/${found.ID}`)).json() : null;
  }, 40000, 1000);
  check("7. An email reached Aicha's work address", Boolean(mail), aichaEmail);
  if (mail) {
    const headers = await (await fetch(`${MAILPIT}/api/v1/message/${mail.ID}/headers`)).json();
    check("7. Subject in French", mail.Subject === "Vous avez reçu des félicitations", mail.Subject);
    check("7. HTML and text parts", Boolean(mail.HTML) && Boolean(mail.Text));
    check("7. Says why and links to settings", mail.Text.includes("Retours et félicitations") && mail.Text.includes("/settings/notifications"));
    check("7. Never quotes the praise", !(mail.Text + mail.HTML).includes("release notes"));
    const unsubscribe = (headers["List-Unsubscribe"]?.[0] ?? "").replace(/^<|>$/g, "");
    check("7. One-click unsubscribe headers", unsubscribe.startsWith(`${BASE}/api/performance/notifications/unsubscribe?token=`)
      && headers["List-Unsubscribe-Post"]?.[0] === "List-Unsubscribe=One-Click", unsubscribe.slice(0, 80));

    // 8. The mail app's POST, without a session, turns off only that group.
    if (unsubscribe) {
      const get = await fetch(unsubscribe);
      const post = await fetch(unsubscribe, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
      check("8. A GET changes nothing; the anonymous POST succeeds", !get.ok && post.status === 200, `GET ${get.status}, POST ${post.status}`);
      const after = data(await call("GET", "/api/performance/notification-preferences", null, aicha));
      const off = after.groups.filter((g) => !g.email).map((g) => g.key);
      check("8. Only Feedback and praise is off", off.includes("feedback-and-praise") && off.length === new Set([...startEmailOff, "feedback-and-praise"]).size, off.join(", "));
      const tampered = await fetch(`${unsubscribe.slice(0, -4)}AAAA`, { method: "POST" });
      check("8. A tampered link is refused", tampered.status === 400, `${tampered.status}`);
      await call("PUT", "/api/performance/notification-preferences", { expectedVersion: after.version, emailOff: startEmailOff }, aicha);
    }
  }

  // Put things back.
  stream.close();
  await call("PUT", "/api/identity/account/language", { language: startLanguage }, aicha);
  check("Clean-up: HR deletes the praise", (await call("DELETE", `/api/performance/praise/${praiseId}`, null, amira)).status === 200);
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
