// add-i18n-foundation (B-105 phase 1) API journey, through the shell at http://localhost:3000/api.
//   node .local-docs/agents/data/journey-language.cjs
// A person's language lives on their account: Aicha sets French, a new sign-in reports it, an unsupported language
// is refused without changing it, the endpoint needs a session and names no other account. Rim, who never chose,
// follows her company (Carthage is en-US, so English). Re-runnable: it puts Aicha back on the language she started
// with (a first run leaves her account saying "en" rather than "never chose", since nothing can clear a choice).
const path = require("path");
const { call, PASSWORD } = require(path.join(__dirname, "../../../.agents/skills/fusion-dev/scripts/api.cjs"));

let failed = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const AICHA = "aicha.bouazizi@example.test";
const RIM = "rim.mahjoub@example.test";

async function signIn(email) {
  const r = await call("POST", "/api/identity/auth/login", { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`sign-in ${email}: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json.data;
}

const setLanguage = (language, token) => call("PUT", "/api/identity/account/language", { language }, token);

(async () => {
  // 0. Where Aicha starts.
  const start = await signIn(AICHA);
  const startLanguage = start.language;
  check("Sign-in reports Aicha's language", ["en", "fr"].includes(startLanguage), startLanguage);

  // 1. Aicha chooses French; the endpoint answers with what sessions will now say.
  const set = await setLanguage("fr", start.accessToken);
  check("Aicha sets French", set.status === 200 && set.json?.data?.language === "fr", `${set.status} ${JSON.stringify(set.json?.data)}`);

  // 2. A new sign-in, as from a browser she has never used, carries it.
  const again = await signIn(AICHA);
  check("A new sign-in returns French", again.language === "fr", again.language);

  // 3. Refresh carries it too.
  const refreshed = await call("POST", "/api/identity/auth/refresh", { refreshToken: again.refreshToken });
  check("A session refresh returns French", refreshed.status === 200 && refreshed.json?.data?.language === "fr",
    `${refreshed.status} ${refreshed.json?.data?.language}`);

  // 4. German is refused with the stable code, and her language stays French.
  const german = await setLanguage("de", again.accessToken);
  check("German is refused as invalid", german.status === 400 && german.json?.details?.code === "unsupported-language",
    `${german.status} ${JSON.stringify(german.json?.details)}`);
  check("Her language is still French", (await signIn(AICHA)).language === "fr");

  // 5. No session, no change; and there is no route that names another account.
  check("Without a session the endpoint refuses", (await setLanguage("en", null)).status === 401);
  const rim = await signIn(RIM);
  const aimed = await call("PUT", `/api/identity/account/${rim.userId}/language`, { language: "fr" }, again.accessToken);
  check("No route takes another account's id", aimed.status === 404, String(aimed.status));

  // 6. Rim never chose: she follows her company. Carthage's locale is en-US, so English. No tenant has an fr-FR
  //    locale locally, and tenant data isn't changed for this; Identity's tests cover an fr-FR company.
  check("Rim follows her company: English", rim.language === "en", rim.language);
  check("Aicha's change left Rim alone", (await signIn(RIM)).language === "en");

  // 7. Put Aicha back.
  const restore = await setLanguage(startLanguage, (await signIn(AICHA)).accessToken);
  check(`Aicha is back on ${startLanguage}`, restore.status === 200 && (await signIn(AICHA)).language === startLanguage);

  console.log(failed ? `\n${failed} failed` : "\nAll passed");
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
