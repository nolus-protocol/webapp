#!/usr/bin/env bash
# House TypeScript style checks for the frontend (src/).
#
# Mechanically enforces the regex-checkable house conventions that pass clean
# against src/ today. Mirrors backend/scripts/style-check.sh. A check that fires
# on pre-existing code owned by another issue is deliberately omitted — a CI
# check that fails on day one is useless.
#
# Runnable from the repo root or from scripts/.
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(dirname "$script_dir")
src_dir="$repo_dir/src"

# A missing source dir (restructure / renamed root) would make every grep below
# match nothing and silently pass the gate. Fail hard instead.
if [ ! -d "$src_dir" ]; then
  echo "ERROR: source dir $src_dir not found — cannot run style checks." >&2
  exit 1
fi

fail=0
report() {
  echo "FAIL: $1" >&2
  fail=1
}

# Parasite-word abstractions: no new class/const/function/type/interface whose
# name ends in a parasite noun (Manager / Helper / Util(s) / Handler) — the name
# describes nothing about what the type does. See ~/.claude/kit typescript-style
# "Avoid parasite words in names". Filenames are intentionally NOT checked: a few
# pre-existing *Utils.ts modules hold only free functions (no parasite-named
# abstraction) and converting those file names is a separate follow-up.
if grep -rnE '(export )?(class|const|function|type|interface) [A-Za-z0-9_]*(Manager|Helper|Utils?|Handler)\b' \
     --include='*.ts' --include='*.vue' "$src_dir"; then
  report "parasite-word abstraction — rename to an intent-revealing name (no Manager/Helper/Util(s)/Handler suffix)"
fi

# Raw hex colors in .vue: markup and chart code must reference the web-components
# design tokens (--color-* / Tailwind utilities) instead of literal hex that
# duplicates a token, so light/dark theming cannot silently diverge from the
# palette. See ~/.claude/kit tailwind-style "No magic colors / sizes". Markup uses
# bg-/text-<token> or var(--color-…); D3/Plot/canvas charts read the token at
# render time via getComputedStyle(...).getPropertyValue('--color-…'). 8-digit
# (alpha) hex is caught too. TermsDialog.vue (static legal-text + link colors) is
# a pre-existing exception owned by a separate issue.
if grep -rnE '#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b' --include='*.vue' "$src_dir" \
     | grep -v '/TermsDialog\.vue:'; then
  report "raw hex color in .vue — use a --color-* design token (bg-/text-<token>, var(--color-…), or getPropertyValue('--color-…')) instead"
fi

if [ "$fail" -ne 0 ]; then
  echo "TypeScript style checks FAILED." >&2
  exit 1
fi
echo "TypeScript style checks passed."
