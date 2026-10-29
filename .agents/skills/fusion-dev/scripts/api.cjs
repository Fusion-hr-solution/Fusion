// Fusion API helper: everything goes through the shell at :3000, like the browser.
// CLI:     node api.cjs <email> <METHOD> <path> [json-body]
//          e.g. node api.cjs qa.admin@lumera-demo.com GET /api/performance/cycles
// Library: const { call, login, inviteToken, PASSWORD } = require("<repo>/.agents/skills/fusion-dev/scripts/api.cjs");
const BASE = "http://localhost:3000";
const MAILPIT = "http://localhost:8025";
// The local password of the platform admin and every demo account; never in git.
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;

async function call(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

async function login(email, password = PASSWORD) {
  if (!password) throw new Error("Set FUSION_LOCAL_PASSWORD to the local account password.");
  const r = await call("POST", "/api/identity/auth/login", { email, password });
  const d = r.json?.data ?? r.json;
  const token = d?.accessToken ?? d?.token;
  if (!token) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return token;
}

// Waits for the newest invitation mail to <email> in Mailpit and returns its token and link.
async function inviteToken(email, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
    const msg = list.messages?.[0];
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const m = (full.Text + full.HTML).match(/\/(?:invite|invites|accept)[^\s"'<>]*?[?/=]([A-Za-z0-9_\-.%]{20,})/);
      if (m) return { token: decodeURIComponent(m[1]), link: m[0] };
      throw new Error(`no token in mail for ${email}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`no invitation mail for ${email}`);
}

module.exports = { BASE, MAILPIT, PASSWORD, call, login, inviteToken };

if (require.main === module) {
  const [email, method, rawPath, body] = process.argv.slice(2);
  // Git Bash (MSYS) rewrites "/api/..." into "C:/Program Files/Git/api/..."; undo that so any shell works.
  const path = rawPath?.replace(/^[A-Za-z]:\/.*?(?=\/api\/)/, "");
  if (!email || !method || !path) {
    console.error("usage: node api.cjs <email> <METHOD> <path> [json-body]");
    process.exit(2);
  }
  (async () => {
    const token = await login(email);
    const r = await call(method.toUpperCase(), path, body ? JSON.parse(body) : undefined, token);
    console.log(r.status);
    console.log(typeof r.json === "string" ? r.json : JSON.stringify(r.json, null, 2));
    process.exit(r.status < 400 ? 0 : 1);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
