#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR"

# Install Node dependencies (uses cached node_modules when available)
npm install

# Configure git proxy (egress proxy is pre-configured in CCR environments)
if [ -n "${HTTPS_PROXY:-}" ]; then
  git config --global http.proxy "$HTTPS_PROXY"
fi

git config --global credential.helper store

# Configure GitHub auth from GITHUB_TOKEN if provided.
# Set this in your Claude Code environment variables:
#   Settings → Environment Variables → GITHUB_TOKEN = <your PAT with repo scope>
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
fi
