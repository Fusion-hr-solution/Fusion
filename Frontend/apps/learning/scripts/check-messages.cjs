#!/usr/bin/env node
/**
 * i18n catalog health check for the EY Academy learning module.
 *
 * Validates the two message catalogs (messages/en.json, messages/fr.json):
 *   1. PARITY  — both locales expose the exact same set of keys (no gaps).
 *   2. ICU     — every message is a valid ICU MessageFormat string
 *                (catches malformed plurals, unbalanced braces, and the
 *                 apostrophe-before-`{` escape trap that crashes next-intl
 *                 at render time).
 *
 * Usage:  node scripts/check-messages.cjs       (or: pnpm check:i18n)
 * Exit code is non-zero if any problem is found, so it works in CI.
 */
const fs = require("fs");
const path = require("path");
const { IntlMessageFormat } = require("intl-messageformat");

const MESSAGES_DIR = path.join(__dirname, "..", "messages");
const LOCALES = ["en", "fr"];

function flatten(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, full, out);
    else out.push([full, v]);
  }
  return out;
}

const catalogs = {};
for (const loc of LOCALES) {
  catalogs[loc] = JSON.parse(
    fs.readFileSync(path.join(MESSAGES_DIR, `${loc}.json`), "utf8")
  );
}

let failed = false;

// 1. Parity
const flat = Object.fromEntries(
  LOCALES.map((l) => [l, flatten(catalogs[l], "", [])])
);
const keys = Object.fromEntries(
  LOCALES.map((l) => [l, new Set(flat[l].map(([k]) => k))])
);
const missingInFr = [...keys.en].filter((k) => !keys.fr.has(k));
const missingInEn = [...keys.fr].filter((k) => !keys.en.has(k));

console.log(`Keys — en: ${keys.en.size}, fr: ${keys.fr.size}`);
if (missingInFr.length || missingInEn.length) {
  failed = true;
  if (missingInFr.length)
    console.log(`  ✗ missing in fr.json:\n    ${missingInFr.join("\n    ")}`);
  if (missingInEn.length)
    console.log(`  ✗ missing in en.json:\n    ${missingInEn.join("\n    ")}`);
} else {
  console.log("  ✓ parity OK (identical key sets)");
}

// 2. ICU validity
let icuErrors = 0;
let icuTotal = 0;
for (const loc of LOCALES) {
  for (const [key, msg] of flat[loc]) {
    if (typeof msg !== "string") continue;
    icuTotal++;
    try {
      new IntlMessageFormat(msg, loc);
    } catch (e) {
      icuErrors++;
      console.log(`  ✗ [${loc}] ${key}: ${e.message}\n      "${msg}"`);
    }
  }
}
if (icuErrors) {
  failed = true;
  console.log(`ICU — ${icuErrors} invalid of ${icuTotal} messages`);
} else {
  console.log(`ICU — ✓ all ${icuTotal} messages parse cleanly`);
}

console.log(failed ? "\nFAILED" : "\nOK");
process.exit(failed ? 1 : 0);
