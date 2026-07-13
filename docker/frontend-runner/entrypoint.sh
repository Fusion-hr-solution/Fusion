#!/bin/sh
# Entrypoint for the Frontend Project grading images. Assembles the candidate submission + author
# tests in the writable tmpfs /work (node_modules symlinked from the read-only image layer), runs
# the framework's test runner with a JUnit reporter, and prints a single machine-readable line
#   ##RESULT##{"total":N,"passed":M}
# that the C# DockerFrontendProjectRunner parses from stdout.
#
# Exit codes:  0 = tests ran (pass/fail conveyed by the counts)   2 = install/setup failure
set -eu

TEMPLATE=/opt/app-template   # baked app + node_modules (read-only image layer)
CONFIG=/opt/runner/config    # image-controlled test config (tamper-proof)
WORK=/work                   # tmpfs scratch
SUB=/submission              # read-only mount of the candidate submission + author tests

# 1) Assemble the run tree in tmpfs. Copy submission, symlink deps, then apply the image-controlled
#    config LAST so a candidate cannot disable the test environment (jsdom) or the reporters.
cp -r "$SUB"/. "$WORK"/ 2>/dev/null || { echo "submission copy failed" >&2; exit 2; }
# Never trust a candidate-supplied node_modules — it could shadow react/vitest with a stub that
# makes every test pass. Drop whatever came in, then link the image's trusted deps.
rm -rf "$WORK/node_modules"
ln -s "$TEMPLATE/node_modules" "$WORK/node_modules" || { echo "node_modules link failed" >&2; exit 2; }
if [ -d "$CONFIG" ]; then
  cp -r "$CONFIG"/. "$WORK"/ || { echo "config copy failed" >&2; exit 2; }
fi
cd "$WORK"

# 2) Run the tests. A test FAILURE must not abort the script — the counts convey pass/fail.
#    Both runners emit a JSON report in Jest's schema, which (unlike JUnit) distinguishes a suite
#    that never collected any tests from a suite whose tests genuinely failed.
set +e
case "${RUNNER_KIND:-vitest}" in
  vitest)
    # With multiple reporters Vitest needs the per-reporter output form (--outputFile.json=…).
    node_modules/.bin/vitest run \
      --config "$WORK/vitest.runner.config.ts" \
      --reporter=default --reporter=json --outputFile.json=/tmp/report.json
    ;;
  jest)
    node_modules/.bin/jest --ci --config "$WORK/jest.config.cjs" \
      --reporters=default --json --outputFile=/tmp/report.json
    ;;
  *)
    echo "unknown RUNNER_KIND=${RUNNER_KIND:-}" >&2
    exit 2
    ;;
esac
RUN_EXIT=$?
set -e

# 3) A missing/broken runner binary (not a test failure) is a setup error. Test runners exit 1 on
#    test failures; exec problems surface as 126/127.
if [ "$RUN_EXIT" -ge 126 ]; then
  echo "test runner exec failed ($RUN_EXIT)" >&2
  exit 2
fi

# 4) Emit the result the C# grader reads.
echo "##RESULT##$(node /usr/local/bin/parse-report.js /tmp/report.json)"
exit 0
