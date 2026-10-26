#!/usr/bin/env node
/**
 * Catalogue check for Fusion's translations, shared by @repo/ds and each Fusion app (their own
 * `scripts/check-messages.cjs` call it with their `messages` folder).
 *
 *   1. Parity: every language holds exactly the same keys, so a missing French line fails before it ships.
 *   2. ICU: every message parses, catching unbalanced braces and bad plurals that would throw at render time.
 *
 * A language is one file (`en.json`) or a folder of one file per namespace (`en/people.json`).
 *
 * Usage: node scripts/check-messages.cjs <messages-dir>   Exit code 1 on any problem.
 */
const fs = require("fs");
const path = require("path");
const { IntlMessageFormat } = require("intl-messageformat");

const LOCALES = ["en", "fr"];

function flatten(value, prefix, out) {
  for (const key of Object.keys(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const child = value[key];
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, full, out);
    else out.push([full, child]);
  }
  return out;
}

/**
 * A language's catalogue, flattened: either one file (`<dir>/<locale>.json`) or one file per namespace
 * (`<dir>/<locale>/<namespace>.json`, whose keys sit under the namespace).
 */
function readCatalogue(dir, locale, problems) {
  const folder = path.join(dir, locale);
  if (!fs.existsSync(folder)) {
    try {
      return flatten(JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8")), "", []);
    } catch (error) {
      problems.push(`${locale}.json: ${error.message}`);
      return [];
    }
  }
  const out = [];
  for (const file of fs.readdirSync(folder).filter((name) => name.endsWith(".json")).sort()) {
    try {
      flatten(JSON.parse(fs.readFileSync(path.join(folder, file), "utf8")), path.basename(file, ".json"), out);
    } catch (error) {
      problems.push(`${locale}/${file}: ${error.message}`);
    }
  }
  return out;
}

/** Returns the problems found in the catalogues under `dir`, one line each; empty when they are sound. */
function checkMessages(dir) {
  const problems = [];
  const flat = {};
  for (const locale of LOCALES) flat[locale] = readCatalogue(dir, locale, problems);
  if (problems.length) return problems;
  // Problems name where the language lives: "fr.json", or "fr/" for a folder of namespaces.
  const source = (locale) => (fs.existsSync(path.join(dir, locale)) ? `${locale}/` : `${locale}.json`);

  const keys = Object.fromEntries(LOCALES.map((locale) => [locale, new Set(flat[locale].map(([key]) => key))]));
  for (const locale of LOCALES) {
    for (const other of LOCALES) {
      if (other === locale) continue;
      for (const key of keys[locale]) {
        if (!keys[other].has(key)) problems.push(`missing in ${source(other)}: ${key}`);
      }
    }
  }

  for (const locale of LOCALES) {
    for (const [key, message] of flat[locale]) {
      if (typeof message !== "string") {
        problems.push(`${source(locale)}: ${key} is not text`);
        continue;
      }
      try {
        new IntlMessageFormat(message, locale);
      } catch (error) {
        problems.push(`${source(locale)}: ${key} doesn't parse (${error.message})`);
      }
    }
  }
  return problems;
}

/** Runs the check for a CLI and exits with its result. */
function main(dir) {
  const problems = checkMessages(dir);
  if (problems.length) {
    console.error(`Catalogues in ${dir}:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`Catalogues in ${path.relative(process.cwd(), dir) || "."}: ${LOCALES.join(", ")} match.`);
}

module.exports = { checkMessages, main };

if (require.main === module) {
  if (!process.argv[2]) {
    console.error("Usage: check-messages <messages-dir>");
    process.exit(2);
  }
  main(path.resolve(process.argv[2]));
}
