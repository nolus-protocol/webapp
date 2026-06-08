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

if [ "$fail" -ne 0 ]; then
  echo "TypeScript style checks FAILED." >&2
  exit 1
fi
echo "TypeScript style checks passed."
