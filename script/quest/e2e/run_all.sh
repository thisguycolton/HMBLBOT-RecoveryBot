#!/usr/bin/env bash
# Run every ACID QUEST check. Needs: the dev server on localhost:3000 (bin/dev), Google Chrome,
# and playwright-core (npm i --no-save playwright-core). Output: tmp/quest-e2e/.
set -u
cd "$(dirname "$0")"
node --version >/dev/null || exit 1
[ -d ../../../node_modules/playwright-core ] || { echo "Install playwright-core first: npm i --no-save playwright-core"; exit 1; }
status=0
run() {
  local out code; out=$(node "$1" 2>&1); code=$?
  local pass fail; pass=$(grep -c '✓' <<<"$out"); fail=$(grep -c '✗' <<<"$out")
  # a script that crashes part way counts as a failure, whatever it printed before
  [ "$code" = 0 ] || { fail=$((fail + 1)); out+=$'\n✗ crashed: '"$(grep -m1 -E 'Error|Timeout' <<<"$out")"; }
  printf '%-36s %3s passed  %s failed  %s\n' "$1" "$pass" "$fail" "$(grep -o 'errors: .*' <<<"$out" | head -1)"
  [ "$fail" = 0 ] || { status=1; grep '✗' <<<"$out"; }
  grep -q 'all invariants hold\|max obstacles on one branch: 1' <<<"$out" && grep 'invariants\|obstacles\|closest\|crowded' <<<"$out"
}
run world_invariants.mjs
run path_rules.mjs
run tools_unit.mjs
run phase2_unit.mjs
node find_seeds.mjs >/dev/null 2>&1   # finds a reachable town and castle for obstacles_help_towns
(cd ../../.. && SENTRY_DSN= bin/rails runner script/quest/e2e/ensure_admin.rb) >/dev/null 2>&1   # local test admin
for t in core_loop encounters tools_merchant_ghost_cannon obstacles_help_towns categories tool_merge phase2 topicificator_admin tale; do run "$t.mjs"; done
exit $status
