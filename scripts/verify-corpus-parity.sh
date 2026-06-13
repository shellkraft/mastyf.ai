#!/usr/bin/env bash
# Canonical corpus gate — TypeScript PolicyEngine + default-policy.yaml.
# Fails CI when attack block rate < 100% or benign pass rate < 100%.
set -euo pipefail
cd "$(dirname "$0")/.."

export MASTYFF_AI_DISABLE_SEMANTIC="${MASTYFF_AI_DISABLE_SEMANTIC:-true}"

echo "==> Corpus parity (MASTYFF_AI_DISABLE_SEMANTIC=${MASTYFF_AI_DISABLE_SEMANTIC})"
pnpm eval

if [[ ! -f corpus-eval-report.json ]]; then
  echo "corpus-eval-report.json missing after pnpm eval" >&2
  exit 1
fi

node -e "
const r = require('./corpus-eval-report.json');
const attacks = r.overall.tp + r.overall.fn;
const benign = r.overall.tn + r.overall.fp;
if (r.overall.fn > 0) {
  console.error('FAIL: ' + r.overall.fn + ' attack(s) evaded policy');
  (r.failures || []).slice(0, 20).forEach((f) => console.error('  ' + f));
  process.exit(1);
}
if (r.overall.fp > 0) {
  console.error('FAIL: ' + r.overall.fp + ' benign false positive(s)');
  process.exit(1);
}
console.log('PASS: ' + r.overall.tp + '/' + attacks + ' attacks blocked, ' + r.overall.tn + '/' + benign + ' benign passed');
"
