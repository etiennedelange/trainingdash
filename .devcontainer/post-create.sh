#!/bin/sh
set -e

# ─── Claude Code CLI ───────────────────────────────────────────────────────────
# Always reinstall to stay current; preserve auth credentials and global config
echo "--> Installing Claude Code CLI..."
CLAUDE_CREDS="$HOME/.claude/.credentials.json"
CLAUDE_CONFIG="$HOME/.claude.json"
[ -f "$CLAUDE_CREDS" ]  && cp "$CLAUDE_CREDS"  /tmp/.claude_creds_backup
[ -f "$CLAUDE_CONFIG" ] && cp "$CLAUDE_CONFIG" /tmp/.claude_config_backup

CLAUDE_INSTALL=$(mktemp)
curl -fsSL https://claude.ai/install.sh -o "$CLAUDE_INSTALL"
bash "$CLAUDE_INSTALL"
rm -f "$CLAUDE_INSTALL"

[ -f /tmp/.claude_creds_backup ]  && mv /tmp/.claude_creds_backup  "$CLAUDE_CREDS"
[ -f /tmp/.claude_config_backup ] && mv /tmp/.claude_config_backup "$CLAUDE_CONFIG"

# ─── OpenCode CLI ───────────────────────────────────────────────────────────────
# Always reinstall the binary to stay current. Sessions, auth, and config live in
# the mounted volumes declared in devcontainer.json, so they survive rebuilds.
echo "--> Preparing OpenCode persistent state..."
mkdir -p "$HOME/.local/share/opencode" "$HOME/.config/opencode" "$HOME/.local/state/opencode"
sudo chown -R "$(id -u):$(id -g)" \
  "$HOME/.local/share/opencode" \
  "$HOME/.config/opencode" \
  "$HOME/.local/state/opencode"

echo "--> Installing OpenCode CLI..."
OPENCODE_INSTALL=$(mktemp)
curl -fsSL https://opencode.ai/install -o "$OPENCODE_INSTALL"
bash "$OPENCODE_INSTALL"
rm -f "$OPENCODE_INSTALL"

# ─── Project dependencies ───────────────────────────────────────────────────────
echo "--> Installing project dependencies..."
pnpm install

# ─── Google Chrome stable ─────────────────────────────────────────────────────
# Installs Chrome stable for chrome-devtools-mcp (headless DevTools inspection).
# Playwright uses its own Chromium build; this is a separate binary.
echo "--> Installing Google Chrome stable..."
CHROME_DEB=$(mktemp --suffix=.deb)
curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o "$CHROME_DEB"
sudo apt-get update
sudo apt-get install -y "$CHROME_DEB"
rm -f "$CHROME_DEB"

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
