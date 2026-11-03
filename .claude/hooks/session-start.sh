#!/bin/bash
# Cloud sessions only: install Graphify and build the code graph in graphify-out/,
# so Claude can query the graph instead of reading whole files (saves tokens).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

GRAPHIFY_VERSION=0.9.101
VENV="$HOME/.graphify-venv"

# Install Graphify into its own venv, only when missing or at another version
if ! "$VENV/bin/python" -I -c "import importlib.metadata as m,sys; sys.exit(m.version('graphifyy')!='$GRAPHIFY_VERSION')" 2>/dev/null; then
  rm -rf "$VENV"
  python3 -m venv "$VENV"
  PIP_DISABLE_PIP_VERSION_CHECK=1 "$VENV/bin/python" -m pip install -q "graphifyy==$GRAPHIFY_VERSION"
fi

# Put graphify on PATH for Claude and for the PreToolUse hooks
if ! ln -sf "$VENV/bin/graphify" /usr/local/bin/graphify 2>/dev/null && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$VENV/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# Build or refresh the graph. AST only, no API key: about 15s cold, under 1s when cached.
"$VENV/bin/graphify" update . >/dev/null 2>&1 || "$VENV/bin/graphify" update . --force >/dev/null 2>&1 || echo "graphify: graph build failed" >&2
