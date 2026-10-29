#!/bin/bash
# Fusion cloud environment setup. Paste this whole file into the environment's Setup script field
# at claude.ai/code; this copy is the source of truth, so re-paste after changing it (that also
# rebuilds the environment cache). It runs before Claude Code starts, once per cache build (about
# every 7 days), must exit 0 and should finish within ~5 min, so independent installs run in parallel.
# Logs: /tmp/fusion-setup/*.log
# The environment's other settings:
# - Network access: Custom, "Also include default list of common package managers" checked, plus
#   builds.dotnet.microsoft.com and ci.dot.net (the .NET SDK download).
# - Environment variables: FUSION_PG_PASSWORD=<any value; the cloud VM's own PostgreSQL gets it>.
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
log=/tmp/fusion-setup
mkdir -p "$log" "$HOME/.claude"

# .NET 10 SDK (not preinstalled). dotnet-install downloads from builds.dotnet.microsoft.com and
# ci.dot.net, which the environment's network list must allow.
(
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh &&
    bash /tmp/dotnet-install.sh --channel 10.0 --install-dir "$HOME/.dotnet" &&
    ln -sf "$HOME/.dotnet/dotnet" /usr/local/bin/dotnet
) >"$log/dotnet.log" 2>&1 &
dotnet_pid=$!

grep -q 'fusion-setup' "$HOME/.bashrc" 2>/dev/null || cat >>"$HOME/.bashrc" <<'EOF'
# fusion-setup
export DOTNET_ROOT="$HOME/.dotnet" PATH="$PATH:$HOME/.dotnet/tools"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
EOF

# pnpm at the versions the repo pins (packageManager: root 9.x for husky, Frontend 10.x).
corepack enable >/dev/null 2>&1 || true

# The clone, when it already exists: warm the pnpm store and NuGet cache, which outlive a fresh
# clone, and make the untracked links so the first session starts with the agent docs loaded.
repo=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ ! -f "$repo/.local-docs/agents/AGENTS.md" ]; then
  found=$(ls -d /home/user/*/.local-docs/agents/AGENTS.md 2>/dev/null | head -1)
  repo=${found%/.local-docs/agents/AGENTS.md}
fi
if [ -n "$repo" ]; then
  (cd "$repo" && pnpm install --frozen-lockfile && cd Frontend && pnpm install --frozen-lockfile) >"$log/pnpm.log" 2>&1 &
  wait "$dotnet_pid" && (cd "$repo" && dotnet restore Backend/EY.HRPlatform.slnx) >"$log/restore.log" 2>&1
  bash "$repo/.agents/skills/fusion-dev/scripts/cloud-session.sh" --links >"$log/links.log" 2>&1
fi
wait

# User instructions for every cloud session (kept in the snapshot).
cat >"$HOME/.claude/CLAUDE.md" <<'EOF'
# Fusion cloud session

This is a Claude Code cloud session on Fusion: Linux, no PowerShell, no running stack.
1. Your first command, from the repo root: `bash .agents/skills/fusion-dev/scripts/cloud-session.sh`.
2. If `.local-docs/agents/AGENTS.md` isn't already in your context, read it now, then
   `.local-docs/agents/memory/MEMORY.md`, and follow them as the project instructions.
EOF
exit 0
