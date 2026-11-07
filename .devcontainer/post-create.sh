#!/bin/sh
set -e

# Claude Code, the GitHub CLI, OpenCode and Wrangler (plus their logins, in
# shared Docker volumes), git identity and SSH commit signing all come from the
# dev-setup feature in devcontainer.json. Run `dev-setup logins` for the login
# commands. This script only covers what's specific to this project.

# ─── Project dependencies ───────────────────────────────────────────────────────
echo "--> Installing project dependencies..."
pnpm install

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
