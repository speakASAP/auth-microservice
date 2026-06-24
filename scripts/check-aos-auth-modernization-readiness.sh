#!/bin/bash
set -euo pipefail

AUTH_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITHUB_ROOT="$(dirname "$AUTH_REPO")"
MARATHON_REPO="${MARATHON_REPO:-$GITHUB_ROOT/marathon}"
SPEAKASAP_REPO="${SPEAKASAP_REPO:-$GITHUB_ROOT/speakasap}"
NAMESPACE="${NAMESPACE:-statex-apps}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() { printf "PASS %s\n" "$1"; PASS_COUNT=$((PASS_COUNT + 1)); }
warn() { printf "WARN %s\n" "$1"; WARN_COUNT=$((WARN_COUNT + 1)); }
fail() { printf "FAIL %s\n" "$1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

run_check() {
  local label="$1"
  shift
  printf "== %s ==\n" "$label"
  if "$@"; then
    pass "$label"
  else
    fail "$label"
  fi
}

printf "AOS Auth modernization no-write readiness check\n"
printf "Auth repo: %s\nMarathon repo: %s\nSpeakASAP repo: %s\nNamespace: %s\n\n" "$AUTH_REPO" "$MARATHON_REPO" "$SPEAKASAP_REPO" "$NAMESPACE"

if [ ! -d "$MARATHON_REPO" ]; then
  fail "Marathon repo missing at $MARATHON_REPO"
else
  run_check "Marathon hosted Auth source contract" bash -c 'cd "$1" && python3 scripts/check-marathon-hosted-auth-contract.py --json-report /tmp/marathon-hosted-auth-contract-readiness.json' _ "$MARATHON_REPO"
fi

if [ -f "$MARATHON_REPO/docs/orchestrator/2026-06-24-marathon-auth-backfill-gate1-approval.md" ]; then
  pass "Marathon Gate 1 approval packet exists"
else
  fail "Marathon Gate 1 approval packet missing"
fi

if [ -f "$MARATHON_REPO/docs/orchestrator/2026-06-24-marathon-auth-backfill-gate2-apply-approval-template.md" ]; then
  pass "Marathon Gate 2 apply approval template exists"
else
  fail "Marathon Gate 2 apply approval template missing"
fi

if [ ! -d "$SPEAKASAP_REPO" ]; then
  fail "SpeakASAP repo missing at $SPEAKASAP_REPO"
else
  run_check "SpeakASAP hosted Auth source contract" bash -c 'cd "$1" && ./scripts/check-hosted-auth-contract.py --json-report /tmp/speakasap-hosted-auth-contract-readiness.json' _ "$SPEAKASAP_REPO"
fi

if [ -f "$AUTH_REPO/docs/orchestrator/2026-06-24-auth-contact-code-live-smoke-approval.md" ]; then
  pass "Auth contact-code live smoke approval packet exists"
else
  fail "Auth contact-code live smoke approval packet missing"
fi

if [ -f "$AUTH_REPO/docs/orchestrator/2026-06-24-auth-contact-code-verify-smoke-approval.md" ]; then
  pass "Auth contact-code verify smoke approval packet exists"
else
  fail "Auth contact-code verify smoke approval packet missing"
fi

run_check "Ecosystem hosted Auth rollout docs" bash -lc "cd '$AUTH_REPO' && npm run check:ecosystem-auth-rollout-docs"
run_check "Auth focused contract specs" bash -lc "cd '$AUTH_REPO' && npm run test:auth-contract"
run_check "Auth deploy shell syntax" bash -n "$AUTH_REPO/scripts/deploy.sh"

if [ -f "$MARATHON_REPO/scripts/deploy.sh" ]; then
  run_check "Marathon deploy shell syntax" bash -n "$MARATHON_REPO/scripts/deploy.sh"
else
  fail "Marathon deploy script missing"
fi

if [ -f "$SPEAKASAP_REPO/scripts/deploy-frontend.sh" ]; then
  run_check "SpeakASAP frontend deploy shell syntax" bash -n "$SPEAKASAP_REPO/scripts/deploy-frontend.sh"
else
  fail "SpeakASAP frontend deploy script missing"
fi

printf "== Runtime deployment readiness ==\n"
if command -v kubectl >/dev/null 2>&1; then
  runtime_output="$(kubectl -n "$NAMESPACE" get deploy auth-microservice auth-microservice-web marathon speakasap speakasap-frontend speakasap-certification speakasap-api-gateway -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas --no-headers 2>&1)" || {
    printf "%s\n" "$runtime_output"
    fail "runtime deployment readiness query"
    runtime_output=""
  }
  if [ -n "$runtime_output" ]; then
    printf "%s\n" "$runtime_output"
    not_ready="$(printf "%s\n" "$runtime_output" | awk '$2 != $3 {print}')"
    if [ -n "$not_ready" ]; then
      printf "%s\n" "$not_ready"
      fail "runtime deployments all ready"
    else
      pass "runtime deployments all ready"
    fi
  fi

  vault_status="$(kubectl get clustersecretstore vault-backend -o 'jsonpath={.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"
  if [ "$vault_status" = "True" ]; then
    pass "vault-backend Ready"
  else
    warn "vault-backend not Ready; runtime allowlist/ExternalSecret verification remains blocked"
  fi
else
  warn "kubectl not available; runtime readiness skipped"
fi

warn "Marathon live DB dry-run/backfill apply remains owner-approval gated and was not run; see marathon/docs/orchestrator/2026-06-24-marathon-auth-backfill-gate1-approval.md"
warn "Real phone/email contact-code delivery smoke remains owner/test-contact gated and was not run; see auth-microservice/docs/orchestrator/2026-06-24-auth-contact-code-live-smoke-approval.md"

printf "\nSummary: pass=%s warn=%s fail=%s\n" "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
