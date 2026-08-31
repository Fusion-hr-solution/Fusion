import { readdir, readFile } from "node:fs/promises";

const appsDirectory = new URL("../apps/", import.meta.url);
const appEntries = await readdir(appsDirectory, { withFileTypes: true });
const violations = [];
let checkedApps = 0;

for (const entry of appEntries) {
  if (!entry.isDirectory()) continue;

  const packageUrl = new URL(`${entry.name}/package.json`, appsDirectory);
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  const devCommand = packageJson.scripts?.dev;

  if (typeof devCommand !== "string") continue;

  checkedApps += 1;
  if (!/--turbo(?:pack)?(?:\s|$)/.test(devCommand)) {
    violations.push(`${packageJson.name ?? entry.name}: ${devCommand}`);
  }
}

if (violations.length > 0) {
  throw new Error(
    `Every Next.js app must use Turbopack for development to keep the multi-MFE runtime within its memory budget.\n${violations.join("\n")}`,
  );
}

console.log(`Verified Turbopack development for ${checkedApps} frontend apps.`);
