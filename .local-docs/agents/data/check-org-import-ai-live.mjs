// Live check that Core HR organization-import AI still works on the shared AI transport (slice 2b, task 9.3).
// Provisions a fresh tenant "AI Import Check <stamp>" (admin ai.import.check.<stamp>@example.test, local password),
// activates its administrator from Mailpit, uploads the parent-reference demo file whose free-text Classification
// column needs AI type mapping, and prints the import's semantic-assistance state. Needs GROQ_API_KEY in Core HR's
// environment. Changes data: one new tenant with one uncommitted import session. Safe to run again (new tenant).
//   node .local-docs/agents/data/check-org-import-ai-live.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { BASE, MAILPIT, PASSWORD, call, login } = require(path.join(here, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));
const FILE = path.join(here, "../../../docs/demo/organization-import-ai/customer-organization-expansion.xlsx");

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
const email = `ai.import.check.${stamp}@example.test`;
const ok = (cond, label, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!cond) process.exitCode = 1;
  return cond;
};

const platform = await login("admin@ey-hr.com");
const provisioned = await call("POST", "/api/identity/platform-admin/tenants", {
  name: `AI Import Check ${stamp}`, locale: "en-US", timeZone: "Africa/Tunis", industry: "Technology",
  modules: ["Performance"], administratorEmail: email, administratorFirstName: "Ines", administratorLastName: "Check",
  idempotencyKey: `ai-import-check-${stamp}`,
}, platform);
ok(provisioned.status < 300, "Provision a fresh tenant", `${provisioned.status}`);

let credential;
for (let i = 0; i < 20 && !credential; i++) {
  const list = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
  const message = list.messages?.[0];
  if (message) {
    const full = await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    const raw = `${full.Text ?? ""}\n${full.HTML ?? ""}`.match(/[?&]credential=([^&"'<>\s]+)/)?.[1];
    if (raw) credential = decodeURIComponent(raw.replace(/&amp;/g, "&"));
  }
  if (!credential) await new Promise((resolve) => setTimeout(resolve, 1000));
}
ok(Boolean(credential), "Bootstrap invitation arrives in Mailpit");
const activated = await fetch(`${BASE}/api/identity/tenant-activation`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ credential, password: PASSWORD, firstName: "Ines", lastName: "Check" }),
});
const activatedBody = await activated.json();
const token = activatedBody?.data?.accessToken ?? activatedBody?.data?.token;
ok(activated.ok && Boolean(token), "Administrator activates", `${activated.status}`);

const form = new FormData();
form.append("file", new Blob([await fs.readFile(FILE)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), path.basename(FILE));
form.append("effectiveDate", new Date().toISOString().slice(0, 10));
form.append("creationToken", crypto.randomUUID());
const started = Date.now();
const upload = await fetch(`${BASE}/api/corehr/organization/imports/intake`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
const uploadBody = await upload.json();
ok(upload.ok, "Upload the parent-reference file", `${upload.status} in ${Date.now() - started} ms`);

const sessionId = uploadBody?.data?.session?.id;
let session = uploadBody?.data?.session;
for (let i = 0; i < 20 && ["Running", "Ready"].includes(session?.semanticAssistance?.state); i++) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  session = (await call("GET", `/api/corehr/organization/imports/${sessionId}`, undefined, token)).json?.data;
}
const assistance = session?.semanticAssistance ?? session?.match?.semanticAssistance;
console.log("semanticAssistance:", JSON.stringify(assistance));
ok(assistance?.state === "Succeeded", "Semantic assistance succeeded", assistance?.state);
ok((assistance?.appliedCount ?? 0) > 0, "Suggestions were applied", `${assistance?.appliedCount} applied, ${assistance?.abstainedCount} abstained`);
console.log(`Tenant admin: ${email} (local password). Session ${sessionId}.`);
