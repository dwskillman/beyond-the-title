#!/usr/bin/env bash
# Dev-machine helper (optional). Runs the builder's built-in self-tests in headless Chrome
# by opening builder.html#selftest and reading the result from the rendered page.
# The same tests can be run by hand: Diagnostics → Built-in self-tests → Run self-tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
OUT="$("$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$PROFILE" --virtual-time-budget=15000 --dump-dom \
  "file://$ROOT/builder/builder.html#selftest" 2>/dev/null)"
RESULT="$(printf '%s' "$OUT" | sed -n '/<pre id="selftest-output"/,/<\/pre>/p' | sed -e 's/<[^>]*>//g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g' -e 's/&quot;/"/g' -e "s/&#39;/'/g")"
if [ -z "$RESULT" ]; then echo "Could not find self-test output (did the page load?)"; exit 2; fi
printf '%s\n' "$RESULT"
printf '%s' "$RESULT" | grep -q '^SELFTEST PASS' || exit 1
