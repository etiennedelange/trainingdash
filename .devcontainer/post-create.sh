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

# ─── Project dependencies ───────────────────────────────────────────────────────
echo "--> Installing project dependencies..."
pnpm install
