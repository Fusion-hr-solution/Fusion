#!/usr/bin/env bash
# First command of every Fusion cloud session (the cloud setup's ~/.claude/CLAUDE.md says so).
#   bash .agents/skills/fusion-dev/scripts/cloud-session.sh [--links]
# Idempotent. Recreates what stays untracked locally, so a fresh clone lacks it: the root CLAUDE.md
# import, the Claude skill link, and Claude's auto-memory folder pointing at the tracked memory/.
# Then refreshes dependencies the clone may lack and prints the toolchain. --links stops after the links.
# Cloud only: on Windows (Git Bash) it does nothing, since those links already exist as junctions.
set -uo pipefail
case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*)
  echo 'cloud-session.sh is for cloud sessions; nothing to do here.'
  exit 0
  ;;
esac
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel) || exit 1
cd "$repo" || exit 1

[ -e CLAUDE.md ] || printf '@.local-docs/agents/AGENTS.md\n' >CLAUDE.md
mkdir -p .claude/skills
[ -e .claude/skills/fusion-dev ] || ln -s ../../.agents/skills/fusion-dev .claude/skills/fusion-dev
memory="$HOME/.claude/projects/$(printf '%s' "$repo" | sed 's/[^A-Za-z0-9]/-/g')/memory"
if [ ! -L "$memory" ]; then
  mkdir -p "$(dirname "$memory")"
  if [ -d "$memory" ]; then
    # Notes written before the link existed: keep them in the tracked folder, park the old one.
    cp -rn "$memory"/. .local-docs/agents/memory/
    mv "$memory" "$memory.old.$(date +%s)"
  fi
  ln -s "$repo/.local-docs/agents/memory" "$memory"
fi
echo "Links: CLAUDE.md, .claude/skills/fusion-dev, memory -> .local-docs/agents/memory"
[ "${1:-}" = --links ] && exit 0

# Fast when the pnpm store is warm. The root install also points git at the husky hooks.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
for dir in . Frontend; do
  if ! (cd "$dir" && pnpm install --frozen-lockfile --prefer-offline >/tmp/fusion-pnpm.log 2>&1); then
    echo "pnpm install failed in $dir:"
    tail -20 /tmp/fusion-pnpm.log
    exit 1
  fi
done
echo "Dependencies installed (root, Frontend)"
echo "dotnet $(dotnet --version 2>/dev/null || echo 'missing: check the setup script') | node $(node -v) | pnpm $(cd Frontend && pnpm -v)"
echo "Backend tests: bash .agents/skills/fusion-dev/scripts/test-backend.sh <Service> [filter] (starts PostgreSQL)"
