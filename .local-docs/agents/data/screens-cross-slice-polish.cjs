// B-089 cross-slice polish audit: walks every Performance surface (plus the Fusion home and Core HR's Performance view)
// as Aicha, Mariam, Omar and Amira on each demo preset, dark 1440×900 through the shell. Records found on a workspace
// (plans, objectives, reviews, rounds, calibration, 1:1 series, feedback requests, people) are opened once per kind.
// Screens go to plans/B-089-screens/<preset>/<persona>-<nn>-<slug>[-pN].png (pN = the next viewport down on a tall page);
// a JSON log beside them records each page's final URL, title, height, console errors and failed calls. Changes no data.
//   node .local-docs/agents/data/screens-cross-slice-polish.cjs [preset ...] [--only=Persona,Persona]
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { BASE, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

const OUT = path.join(__dirname, "../plans/B-089-screens");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "demo-presets.local.json"), "utf8"));
const PERSONAS = ["Aicha", "Mariam", "Omar", "Amira"];
// Pages that don't change with the phase are taken on Planning only; later presets take what their phase changes.
const PHASE_PAGES = {
  midyear: { pages: ["home", "overview", "my-plan", "my-team", "one-on-ones", "goals", "goals-list", "cycle", "cycle-insights"], records: ["plan", "objective", "series", "person", "feedback-request"] },
  yearend: { pages: ["home", "overview", "my-plan", "my-team", "reviews", "cycle", "cycle-insights", "cycle-next", "overview-next"], records: ["review", "round", "calibration", "peer-request", "person"] },
  nextcycle: { pages: ["home", "overview", "my-plan", "my-team", "reviews", "cycle", "cycle-insights", "cycle-next", "overview-next"], records: ["review", "round", "calibration", "person"] },
  fresh: { pages: ["home", "overview", "my-plan", "my-team", "reviews", "one-on-ones", "feedback-received", "goals", "cycle", "settings"], records: [] },
};
const MAX_PARTS = 3;

const G = "[0-9a-f-]{36}";
// Record kinds, discovered from links on the workspaces. Objectives open as a drawer when clicked (S-04).
const RECORDS = [
  ["plan", new RegExp(`^/performance/cycles/${G}/plans/${G}$`)],
  ["team-plan", new RegExp(`^/performance/team/${G}$`)],
  ["objective", new RegExp(`^/performance/cycles/${G}/objectives/${G}$`), "click"],
  ["review", new RegExp(`^/performance/reviews/${G}$`)],
  ["round", new RegExp(`^/performance/reviews/rounds/${G}$`)],
  ["calibration", new RegExp(`^/performance/reviews/rounds/${G}/calibration$`)],
  ["peer-request", new RegExp(`^/performance/reviews/peer-requests/${G}$`)],
  ["series", new RegExp(`^/performance/one-on-ones/${G}$`)],
  ["feedback-request", new RegExp(`^/performance/feedback/requests/${G}$`)],
  ["person", new RegExp(`^/performance/people/${G}$`)],
];

function workspaces(persona, cycles) {
  const admin = persona === "Amira";
  const manager = persona !== "Aicha";
  const employee = persona === "Aicha";
  // Pages that look the same for everyone are taken once (Aicha, or Amira for admin-only ones).
  const list = [
    ["home", "/"],
    ["overview", "/performance"],
    ["my-plan", "/performance/plan"],
    manager && ["my-team", "/performance/team"],
    ["one-on-ones", "/performance/one-on-ones"],
    ["feedback-received", "/performance/feedback"],
    employee && ["feedback-given", "/performance/feedback?tab=given"],
    ["feedback-requests", "/performance/feedback?tab=requests"],
    employee && ["feedback-praise", "/performance/feedback?tab=praise"],
    persona === "Mariam" && ["feedback-team", "/performance/feedback?view=team"],
    ["reviews", "/performance/reviews"],
    (employee || admin) && ["goals", "/performance/goals"],
    admin && ["goals-list", "/performance/goals?view=list"],
    (employee || persona === "Mariam") && ["core-profile-performance", "/core/profile/performance"],
    admin && ["cycle", "/performance/cycle"],
    admin && cycles.current && ["cycle-insights", `/performance/cycle?cycle=${cycles.current.id}&view=insights`],
    admin && cycles.next && ["cycle-next", `/performance/cycle?cycle=${cycles.next.id}`],
    admin && cycles.next && ["overview-next", `/performance?cycle=${cycles.next.id}`],
    admin && ["settings", "/performance/settings"],
    employee && cycles.last && ["overview-last-year", `/performance?cycle=${cycles.last.id}`],
    employee && cycles.last && ["reviews-last-year", `/performance/reviews?cycle=${cycles.last.id}`],
  ];
  return list.filter(Boolean);
}

async function signIn(browser, email, log) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await context.addInitScript(() => {
    try { localStorage.setItem("theme", "dark"); } catch { /* ignore */ }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") log.current?.console.push(m.text().slice(0, 300)); });
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.includes("/api/")) log.current?.failed.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, "")}`);
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240000 });
  for (let attempt = 0; attempt < 4 && new URL(page.url()).pathname.includes("signin"); attempt++) {
    const emailBox = page.locator('input[type="email"], input[name="email"]').first();
    await emailBox.waitFor({ timeout: 240000 });
    await page.waitForTimeout(800);
    await emailBox.fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    if ((await emailBox.inputValue()) !== email) continue;
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes("signin"), { timeout: 30000 }).catch(() => {});
  }
  const signedIn = await page.getByRole("complementary", { name: "Fusion navigation" }).first()
    .waitFor({ timeout: 120000 }).then(() => true, () => false);
  if (!signedIn) throw new Error(`Could not sign in as ${email}`);
  return page;
}

async function settle(page) {
  // The bell polls, so the network never goes idle: wait briefly, then for skeletons to go.
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  // Wait out skeletons and spinners, then let late layout settle.
  await page.waitForFunction(() => !document.querySelector('[data-slot="skeleton"], [aria-busy="true"]'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function capture(page, dir, name, entry) {
  const height = await page.evaluate(() => {
    const main = document.querySelector("main");
    const scroller = [main, document.scrollingElement].find((el) => el && el.scrollHeight > el.clientHeight + 4);
    return { total: scroller ? scroller.scrollHeight : window.innerHeight, view: scroller ? scroller.clientHeight : window.innerHeight };
  });
  entry.height = height.total;
  entry.files = [];
  const parts = Math.min(MAX_PARTS, Math.max(1, Math.ceil((height.total - 40) / height.view)));
  for (let i = 0; i < parts; i++) {
    if (i > 0) {
      await page.evaluate((y) => {
        const main = document.querySelector("main");
        const scroller = [main, document.scrollingElement].find((el) => el && el.scrollHeight > el.clientHeight + 4);
        scroller?.scrollTo(0, y);
      }, i * (height.view - 80));
      await page.waitForTimeout(400);
    }
    const file = `${name}${i ? `-p${i + 1}` : ""}.png`;
    await page.screenshot({ path: path.join(dir, file) });
    entry.files.push(file);
  }
  entry.title = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? null);
}

async function hrefs(page) {
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => new URL(a.href, location.href))
    .filter((u) => u.origin === location.origin).map((u) => u.pathname));
}

(async () => {
  const args = process.argv.slice(2);
  const only = (args.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
  // --pages=slug,slug retakes only those workspaces (no records) as <persona>-r-<slug>.png, waiting longer.
  const retake = (args.find((a) => a.startsWith("--pages=")) ?? "").slice(8).split(",").filter(Boolean);
  const presetKeys = args.filter((a) => !a.startsWith("--"));
  const keys = presetKeys.length ? presetKeys : Object.keys(manifest.presets);
  const browser = await chromium.launch();
  try {
    for (const key of keys) {
      const preset = manifest.presets[key];
      if (!preset) throw new Error(`No built preset "${key}"`);
      const dir = path.join(OUT, key);
      fs.mkdirSync(dir, { recursive: true });
      const logFile = path.join(dir, "walk.json");
      const results = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, "utf8")) : {};
      for (const persona of only.length ? only : PERSONAS) {
        const email = preset.personas.find((p) => p.name.startsWith(persona)).email;
        const log = { current: null };
        const page = await signIn(browser, email, log);
        const entries = [];
        const found = new Map();
        let n = 0;
        const visit = async (slug, url, how) => {
          const name = retake.length ? `${persona.toLowerCase()}-r-${slug}` : `${persona.toLowerCase()}-${String(++n).padStart(2, "0")}-${slug}`;
          const entry = { name, url, console: [], failed: [] };
          log.current = entry;
          try {
            if (how === "click") {
              const link = page.locator(`a[href$="${url.replace(/^\/performance/, "")}"]`).first();
              await link.scrollIntoViewIfNeeded();
              await link.click();
            } else {
              await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 240000 });
            }
            await page.getByRole("complementary", { name: "Fusion navigation" }).first().waitFor({ timeout: 240000 }).catch(() => {});
            await settle(page);
            if (retake.length) await settle(page);
            entry.finalUrl = page.url().replace(BASE, "");
            await capture(page, dir, name, entry);
            for (const p of await hrefs(page)) {
              for (const [kind, re] of RECORDS) if (re.test(p) && !found.has(kind)) found.set(kind, { path: p, from: url });
            }
          } catch (error) {
            entry.error = String(error.message ?? error).slice(0, 300);
          }
          log.current = null;
          entries.push(entry);
          results[retake.length ? `${persona}-retake` : persona] = entries;
          fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
          console.log(`${key} ${name} ${entry.error ? `ERROR ${entry.error}` : `${entry.files?.length ?? 0} part(s)`}`);
        };
        const phase = retake.length ? { pages: retake, records: [] } : PHASE_PAGES[key];
        for (const [slug, url] of workspaces(persona, preset.cycles)) {
          if (!phase || phase.pages.includes(slug)) await visit(slug, url);
        }
        // Records: open the first of each kind, from the page that linked it (clicks need the link on screen).
        for (const [kind, , how] of RECORDS) {
          const hit = found.get(kind);
          if (!hit || (phase && !phase.records.includes(kind))) continue;
          if (how === "click") {
            await page.goto(`${BASE}${hit.from}`, { waitUntil: "domcontentloaded", timeout: 240000 });
            await settle(page);
            await visit(`${kind}-drawer`, hit.path, "click");
            await visit(`${kind}-page`, hit.path);
          } else {
            await visit(kind, hit.path);
          }
        }
        // Second-level records (calibration from a round, people from a team plan, ...).
        for (const [kind, , how] of RECORDS) {
          if (how === "click" || entries.some((e) => e.name.endsWith(`-${kind}`)) || (phase && !phase.records.includes(kind))) continue;
          const hit = found.get(kind);
          if (hit) await visit(kind, hit.path);
        }
        results[retake.length ? `${persona}-retake` : persona] = entries;
        await page.context().close();
      }
      fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
