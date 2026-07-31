// Dependency-free tests for parse-report.js — the piece that decides whether a submission is
// auto-scored or routed to human review. Run: node test-parse-report.js   (exits non-zero on failure)
//
// Fixtures mirror the JSON schema Vitest and Jest both emit.
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PARSER = path.join(__dirname, "parse-report.js");

function runParser(report) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pr-")), "report.json");
  if (report !== undefined) fs.writeFileSync(file, typeof report === "string" ? report : JSON.stringify(report));
  return execFileSync(process.execPath, [PARSER, file], { encoding: "utf8" }).trim();
}

// A suite whose tests actually executed. Shape verified against a real Vitest 2.1.9 report:
// note Vitest does NOT emit `numRuntimeErrorTestSuites` (Jest does) — it emits numFailedTestSuites.
// So on Vitest, collection failures are caught by the fallback (empty assertionResults) + total===0.
const suite = (statuses) => ({
  name: "/work/src/App.test.jsx",
  status: statuses.every((s) => s === "passed") ? "passed" : "failed",
  message: "",
  assertionResults: statuses.map((status, i) => ({ status, title: `t${i}`, failureMessages: [] })),
});

// A suite that never collected: Vitest reports it failed, with a message and ZERO assertions.
const collectionFailure = (message) => ({
  name: "/work/src/App.test.jsx",
  status: "failed",
  message,
  assertionResults: [],
});

const cases = [
  {
    name: "[vitest] all tests pass → full score",
    report: {
      numTotalTestSuites: 1, numPassedTestSuites: 1, numFailedTestSuites: 0,
      numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, success: true,
      testResults: [suite(["passed", "passed"])],
    },
    expect: { total: 2, passed: 2 },
  },
  {
    name: "[vitest] partial credit",
    report: {
      numTotalTestSuites: 1, numPassedTestSuites: 0, numFailedTestSuites: 1,
      numTotalTests: 2, numPassedTests: 1, numFailedTests: 1, success: false,
      testResults: [suite(["passed", "failed"])],
    },
    expect: { total: 2, passed: 1 },
  },
  {
    name: "[vitest] ALL tests fail but DID run → auto-score 0 (must NOT go to review)",
    // The regression guard: numFailedTestSuites=1 here too, so we must NOT treat a failed SUITE as
    // a collection failure — otherwise every wrong answer would flood the review queue.
    report: {
      numTotalTestSuites: 1, numPassedTestSuites: 0, numFailedTestSuites: 1,
      numTotalTests: 2, numPassedTests: 0, numFailedTests: 2, success: false,
      testResults: [suite(["failed", "failed"])],
    },
    expect: { total: 2, passed: 0 },
  },
  {
    name: "[vitest] collection failure (compile error, no numRuntimeErrorTestSuites) → review",
    report: {
      numTotalTestSuites: 1, numPassedTestSuites: 0, numFailedTestSuites: 1,
      numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, success: false,
      testResults: [collectionFailure("Error: Failed to load url ./App.jsx")],
    },
    expect: { total: 0, passed: 0 },
  },
  {
    name: "[jest] collection failure via numRuntimeErrorTestSuites → review",
    report: {
      numTotalTests: 0, numPassedTests: 0, numRuntimeErrorTestSuites: 1,
      testResults: [collectionFailure("SyntaxError: Unexpected token")],
    },
    expect: { total: 0, passed: 0 },
  },
  {
    name: "one suite collected, another failed to compile → review (result is incomplete)",
    report: {
      numTotalTestSuites: 2, numPassedTestSuites: 1, numFailedTestSuites: 1,
      numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, success: false,
      testResults: [suite(["passed", "passed"]), collectionFailure("SyntaxError")],
    },
    expect: { total: 0, passed: 0 },
  },
  {
    name: "no tests matched the glob → review (not a silent zero)",
    report: { numTotalTestSuites: 0, numTotalTests: 0, numPassedTests: 0, testResults: [] },
    expect: { total: 0, passed: 0 },
  },
  { name: "missing report file → {}", report: undefined, expect: {} },
  { name: "garbled report → {}", report: "{not json", expect: {} },
];

let failed = 0;
for (const c of cases) {
  const actual = runParser(c.report);
  const expected = JSON.stringify(c.expect);
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
