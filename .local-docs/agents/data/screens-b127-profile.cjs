#!/usr/bin/env node
/**
 * B-127 screens: the redesigned profile, dark at 1440×900, through the shell. Changes no data (the edit and the
 * photo dialog are cancelled). Run `seed-b127-personal.cjs` first so the Personal tab has values.
 *
 * As Amira (HR): Mariam's record on Job and Personal. As Aicha: My profile on Personal, editing Contact in place,
 * and the photo dialog cropping a generated image. As Leila (a colleague outside Mariam's branch): Mariam's
 * header, rail and reporting line.
 *
 * Usage: node .local-docs/agents/data/screens-b127-profile.cjs
 * Writes PNGs to .local-docs/agents/plans/B-127-screens/<name>.png.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("C:/Code/EY/Fusion/Frontend/node_modules/playwright");
const { call, login } = require("C:/Code/EY/Fusion/.agents/skills/fusion-dev/scripts/api.cjs");

const BASE = "http://localhost:3000";
const PASSWORD = process.env.FUSION_LOCAL_PASSWORD;
const OUT = path.join(__dirname, "..", "plans", "B-127-screens");
fs.mkdirSync(OUT, { recursive: true });

async function signIn(page, email) {
  // The form can submit before hydration and go nowhere; one more try usually lands.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await trySignIn(page, email);
    } catch (error) {
      if (attempt >= 3) throw error;
    }
  }
}

async function trySignIn(page, email) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const submit = page.locator('button[type="submit"]');
  await submit.waitFor({ state: "visible", timeout: 120_000 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.waitForTimeout(500);
    if ((await page.inputValue("#email")) === email) break;
  }
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

async function open(page, url, ready) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 240_000 });
  if (ready) await ready.waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForTimeout(1500);
}

(async () => {
  const chart = (await call("GET", "/api/corehr/org-chart", null, await login("amira.khelifi@example.test"))).json.data;
  const mariam = chart.people.find((p) => p.displayName === "Mariam Gharbi").employeeKey;

  const browser = await chromium.launch();
  try {
    const newPage = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
      await context.addInitScript(() => { try { window.localStorage.setItem("theme", "dark"); } catch {} });
      return context.newPage();
    };

    // A stand-in image for the crop (generated, never saved).
    const maker = await newPage();
    await maker.setContent(`<canvas id=c width=900 height=640></canvas><script>
      const c=document.getElementById('c').getContext('2d');
      const g=c.createLinearGradient(0,0,900,640);g.addColorStop(0,'#3b4252');g.addColorStop(1,'#a3be8c');
      c.fillStyle=g;c.fillRect(0,0,900,640);c.fillStyle='#eceff4';c.beginPath();c.arc(450,250,120,0,7);c.fill();
      c.beginPath();c.ellipse(450,560,230,170,0,0,7);c.fill();</script>`);
    const image = await maker.locator("#c").screenshot({ type: "png" });
    await maker.context().close();

    const amira = await newPage();
    await signIn(amira, "amira.khelifi@example.test");
    await open(amira, `/core/people/${mariam}`, amira.getByRole("cell", { name: "VP, Product" }).first());
    await shot(amira, "01-hr-job");
    await open(amira, `/core/people/${mariam}?tab=personal`, amira.getByRole("heading", { name: "Emergency contacts" }));
    await shot(amira, "02-hr-personal");
    await amira.context().close();

    const aicha = await newPage();
    await signIn(aicha, "aicha.bouazizi@example.test");
    await open(aicha, "/core/profile?tab=personal", aicha.getByRole("heading", { name: "Home address" }));
    await shot(aicha, "03-self-personal");
    await aicha.getByRole("button", { name: "Edit Contact" }).click();
    await aicha.waitForTimeout(500);
    await shot(aicha, "04-self-edit-contact");
    await aicha.getByRole("button", { name: "Cancel" }).click();
    await open(aicha, "/core/profile", null);
    await shot(aicha, "05-self-job");
    await aicha.getByRole("button", { name: "Change photo" }).click();
    await aicha.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: image });
    await aicha.getByRole("slider", { name: "Zoom" }).waitFor({ state: "visible" });
    await aicha.getByRole("slider", { name: "Zoom" }).focus();
    for (let i = 0; i < 25; i += 1) await aicha.keyboard.press("ArrowRight");
    await aicha.waitForTimeout(400);
    await shot(aicha, "06-photo-dialog");
    await aicha.context().close();

    const leila = await newPage();
    await signIn(leila, "leila.baccouche@example.test");
    await open(leila, `/core/people/${mariam}`, leila.getByRole("heading", { name: "Reporting line" }));
    await shot(leila, "07-colleague");
    await leila.context().close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
