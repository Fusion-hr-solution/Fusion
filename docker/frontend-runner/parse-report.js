// Reads the test runner's JSON report (Vitest and Jest both emit Jest's schema) and prints
//   {"total":N,"passed":M}
// for the C# grader, which reads it from the ##RESULT## line on stdout.
//
// IMPORTANT — collection failures. A suite that fails to COLLECT (syntax error, bad import, broken
// config) is reported as a failed suite with ZERO assertions. Naively that looks like "0 of 1 tests
// passed", which would silently award 0 — and would hide an image/config fault of OURS behind a
// candidate's score. So we emit {"total":0,"passed":0}; the grader treats a zero total as "no usable
// result" and routes the attempt to human review instead of guessing.
//
// Real test failures still score normally: those suites DO have assertions.
const fs = require("fs");

function emit(value) {
  process.stdout.write(JSON.stringify(value));
  process.exit(0);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
} catch {
  emit({}); // no/unreadable report → grader queues for review
}

const total = Number(report.numTotalTests ?? 0);
const passed = Number(report.numPassedTests ?? 0);
const runtimeErrors = Number(report.numRuntimeErrorTestSuites ?? 0);

// Fallback for runners that omit numRuntimeErrorTestSuites: a suite entry carrying a failure/message
// but no assertions never actually executed its tests.
const suites = Array.isArray(report.testResults) ? report.testResults : [];
const suiteErrors = suites.filter(
  (suite) =>
    (!Array.isArray(suite.assertionResults) || suite.assertionResults.length === 0) &&
    (suite.status === "failed" || Boolean(suite.message)),
).length;

if (runtimeErrors > 0 || suiteErrors > 0 || total === 0) {
  emit({ total: 0, passed: 0 });
}

emit({ total, passed });
