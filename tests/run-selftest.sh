#!/usr/bin/env bash
# Dev-machine helper (optional). Runs the builder's built-in self-tests in headless Chrome.
# Same as: node tests/run-selftest.mjs   (Node 22 or newer)
set -euo pipefail
exec node "$(cd "$(dirname "$0")" && pwd)/run-selftest.mjs" "$@"
