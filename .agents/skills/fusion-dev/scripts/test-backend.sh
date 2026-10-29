#!/usr/bin/env bash
# Runs a Fusion backend test project with the right environment and prints one summary line.
#   bash .agents/skills/fusion-dev/scripts/test-backend.sh Performance ["FullyQualifiedName~Review"]
# Bash twin of test-backend.ps1 for cloud sessions (Linux):
# - On Linux with a packaged PostgreSQL (the cloud VM), starts it if it's down and sets the postgres
#   password from FUSION_PG_PASSWORD.
# - Sets FUSION_<SERVICE>_RELATIONAL_TEST_CONNECTION (Identity: FUSION_TEST_PG) when the service has
#   relational tests, so they run instead of skipping silently.
# - Builds into a separate artifacts folder and shuts the compiler servers down after.
# On Windows use test-backend.ps1: it also handles the running stack's file lock and the memory check.
set -uo pipefail
service=${1:-}
filter=${2:-}
case $service in
  Performance | CoreHR | Identity | Interview | Training) ;;
  *) echo 'Usage: test-backend.sh <Performance|CoreHR|Identity|Interview|Training> [filter]' >&2; exit 2 ;;
esac
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel) || exit 1
project="$repo/Backend/EY.HRPlatform.$service.Tests"
[ -d "$project" ] || { echo "No test project at $project" >&2; exit 1; }

if [ "$service" = Identity ]; then var=FUSION_TEST_PG; else var="FUSION_${service^^}_RELATIONAL_TEST_CONNECTION"; fi
uses_var=false
grep -rqF --include='*.cs' "$var" "$project" && uses_var=true

as_postgres() {
  if [ "$(id -u)" = 0 ]; then (cd / && su postgres -c "$1"); else (cd / && sudo -E -u postgres bash -c "$1"); fi
}

if $uses_var; then
  [ -n "${FUSION_PG_PASSWORD:-}" ] || { echo 'Set FUSION_PG_PASSWORD (cloud: in the environment variables).' >&2; exit 1; }
  if [ -d /etc/postgresql ] && command -v pg_isready >/dev/null; then
    pg_isready -q -h localhost || { service postgresql start >/dev/null || exit 1; }
    for _ in $(seq 20); do pg_isready -q -h localhost && break; sleep 0.5; done
    as_postgres 'psql -qX -v pw="$FUSION_PG_PASSWORD"' >/dev/null <<'SQL' || exit 1
ALTER USER postgres PASSWORD :'pw';
SQL
  fi
  export "$var=Host=localhost;Port=5432;Username=postgres;Password=$FUSION_PG_PASSWORD"
fi

args=(test "$project" --artifacts-path "${TMPDIR:-/tmp}/fusion-test-$service" --nologo)
[ -n "$filter" ] && args+=(--filter "$filter")
out=$(dotnet "${args[@]}" 2>&1)
code=$?

summary=$(grep -E '(Passed|Failed)![[:space:]]+-' <<<"$out" | tail -1)
if [ -n "$summary" ]; then
  count() { sed -nE "s/.*$1:[[:space:]]+([0-9]+).*/\1/p" <<<"$summary"; }
  echo "$service tests | Passed $(count Passed) | Failed $(count Failed) | Skipped $(count Skipped)$($uses_var && echo ' (relational on)')"
else
  tail -30 <<<"$out"
fi
grep -E '^[[:space:]]+(Failed|Skipped) ' <<<"$out" | head -20

dotnet build-server shutdown >/dev/null 2>&1
exit $code
