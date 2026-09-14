#!/bin/sh
set -e

# ─── Home directory ownership ──────────────────────────────────────────────────
# The volume mounts in devcontainer.json target ~/.claude and subdirectories under
# ~/.local and ~/.config. Docker creates missing parent directories (and, for a
# fresh named volume, the mount point itself) as root, regardless of remoteUser.
# So ~/.local, ~/.local/share, and ~/.claude can end up root-owned even though
# the mounted leaf dirs look fine. Claude Code's installer writes into sibling
# paths (~/.local/bin, ~/.local/share/claude) under that same ~/.local, so fix
# ownership of everything up front, before either CLI installs, so this survives
# container rebuilds without manual intervention.
sudo mkdir -p "$HOME/.local" "$HOME/.config" "$HOME/.claude"
sudo chown -R "$(id -u):$(id -g)" "$HOME/.local" "$HOME/.config" "$HOME/.claude"

# ─── Claude Code CLI ───────────────────────────────────────────────────────────
# Always reinstall the binary to stay current. Auth (~/.claude/.credentials.json)
# and session/project history under ~/.claude live in the trainingdash-claude-data
# volume mounted in devcontainer.json, so they survive rebuilds on their own.
# ~/.claude.json is a single file outside that mounted directory, so persist it by
# relocating it into the volume once and symlinking it back on every rebuild.
echo "--> Installing Claude Code CLI..."
CLAUDE_CONFIG="$HOME/.claude.json"
CLAUDE_CONFIG_PERSISTED="$HOME/.claude/claude.json"
if [ -f "$CLAUDE_CONFIG" ] && [ ! -L "$CLAUDE_CONFIG" ]; then
  mv "$CLAUDE_CONFIG" "$CLAUDE_CONFIG_PERSISTED"
fi
ln -sf "$CLAUDE_CONFIG_PERSISTED" "$CLAUDE_CONFIG"

CLAUDE_INSTALL=$(mktemp)
curl -fsSL https://claude.ai/install.sh -o "$CLAUDE_INSTALL"
bash "$CLAUDE_INSTALL"
rm -f "$CLAUDE_INSTALL"

# ─── OpenCode CLI ───────────────────────────────────────────────────────────────
# Always reinstall the binary to stay current. Sessions, auth, and config live in
# the mounted volumes declared in devcontainer.json, so they survive rebuilds.
echo "--> Preparing OpenCode persistent state..."
mkdir -p "$HOME/.local/share/opencode" "$HOME/.config/opencode" "$HOME/.local/state/opencode"

echo "--> Installing OpenCode CLI..."
OPENCODE_INSTALL=$(mktemp)
curl -fsSL https://opencode.ai/install -o "$OPENCODE_INSTALL"
bash "$OPENCODE_INSTALL"
rm -f "$OPENCODE_INSTALL"

# ─── Project dependencies ───────────────────────────────────────────────────────
echo "--> Installing project dependencies..."
pnpm install

# ─── Wrangler CLI ───────────────────────────────────────────────────────────────
# Installed globally so `wrangler` works directly in a shell (e.g. `wrangler d1
# execute`), not just via `pnpm exec`/`npx`. The project's own devDependency
# (package.json) is what `pnpm run` scripts use and is version-pinned; this
# global copy is just for convenience and floats to latest on every rebuild.
#
# pnpm's global bin dir isn't on PATH by default in this base image, so
# `pnpm setup` writes the PNPM_HOME export into ~/.bashrc — but that only
# takes effect in new shells, so also export it here for this script's own
# `pnpm add -g` call to work immediately.
echo "--> Configuring pnpm global bin directory..."
pnpm setup
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME/bin:$PATH"

echo "--> Installing Wrangler CLI..."
pnpm add -g wrangler

# ─── Google Chrome stable ─────────────────────────────────────────────────────
# Installs Chrome stable for chrome-devtools-mcp (headless DevTools inspection).
# Playwright uses its own Chromium build; this is a separate binary. Uses the
# apt-repo installer script (registers Google's signing key + apt source) rather
# than a one-off .deb download, so dependency resolution is handled by apt.
echo "--> Installing Google Chrome stable..."
sudo bash .devcontainer/install-chrome.sh

# ─── cloudflared ────────────────────────────────────────────────────────────────
# Needed for `pnpm tunnel` — exposes the local dev server over public HTTPS so
# Strava's webhook can reach it (see README's "Webhooks in development").
echo "--> Installing cloudflared..."
CLOUDFLARED_DEB=$(mktemp --suffix=.deb)
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o "$CLOUDFLARED_DEB"
sudo apt-get install -y "$CLOUDFLARED_DEB"
rm -f "$CLOUDFLARED_DEB"

# ─── chrome-devtools-mcp ────────────────────────────────────────────────────────
# Registered in .mcp.json; pre-fetch the package so the first `claude` launch
# doesn't pay the npx download cost.
echo "--> Pre-fetching chrome-devtools-mcp..."
npx -y chrome-devtools-mcp@latest --version || true
