#!/usr/bin/env bash
# House Rust style checks for the nolus-backend crate.
#
# Mechanically enforces the regex-checkable house conventions that already pass
# clean against backend/src. Checks that fire on pre-existing code owned by the
# dependent fix-issues (#170/#179/#186/#187/#188) or on sanctioned crate-wide
# usage (lazy_static!, anyhow) are deliberately omitted — a CI check that fails
# on day one is useless. Add the corresponding check as each fix-issue lands.
#
# Runnable from the repo root or from backend/.
set -euo pipefail

# Resolve the crate's src/ dir regardless of where the script is invoked from.
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
crate_dir=$(dirname "$script_dir")
src_dir="$crate_dir/src"

# A missing source dir (crate restructure / renamed root) would make every `rg -q`
# below match nothing and silently pass the gate. Fail hard instead.
if [ ! -d "$src_dir" ]; then
  echo "ERROR: source dir $src_dir not found — cannot run style checks." >&2
  exit 1
fi

# ripgrep is mandatory: every check below is an `rg` invocation, so a missing rg
# must fail hard rather than silently skip checks and report a false pass.
if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is not installed — cannot run style checks." >&2
  exit 1
fi

fail=0
report() {
  echo "FAIL: $1" >&2
  fail=1
}

# Un-combined matches! arms on the same scrutinee.
# Collapse `matches!(x, A) || matches!(x, B)` into `matches!(x, A | B)`.
if rg -q 'matches!\([^)]+\)\s*\|\|\s*matches!' --type rust "$src_dir"; then
  rg -n 'matches!\([^)]+\)\s*\|\|\s*matches!' --type rust "$src_dir" >&2 || true
  report "un-combined matches! arms — see: Combine matches! arms"
fi

# Empty / placeholder expect messages.
# expect() messages must state what was expected.
if rg -q '\.expect\(\s*""\s*\)|\.expect\("ok"\)' --type rust "$src_dir"; then
  rg -n '\.expect\(\s*""\s*\)|\.expect\("ok"\)' --type rust "$src_dir" >&2 || true
  report "non-descriptive expect message — see: Result::expect messages state what was expected"
fi

# No crate-owned default Cargo feature.
if rg -q '^\s*default\s*=\s*\[' "$crate_dir/Cargo.toml"; then
  rg -n '^\s*default\s*=\s*\[' "$crate_dir/Cargo.toml" >&2 || true
  report "default Cargo feature exposed — see: No default Cargo features"
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "Style checks passed."
