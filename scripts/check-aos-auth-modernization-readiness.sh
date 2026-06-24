#!/bin/bash
set -euo pipefail

AUTH_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITHUB_ROOT="$(dirname "$AUTH_REPO")"
MARATHON_REPO="${MARATHON_REPO:-$GITHUB_ROOT/marathon}"
SPEAKASAP_REPO="${SPEAKASAP_REPO:-$GITHUB_ROOT/speakasap}"
ORDERS_REPO="${ORDERS_REPO:-$GITHUB_ROOT/orders-microservice}"
SHOP_ASSISTANT_REPO="${SHOP_ASSISTANT_REPO:-$GITHUB_ROOT/shop-assistant}"
CATALOG_REPO="${CATALOG_REPO:-$GITHUB_ROOT/catalog-microservice}"
WAREHOUSE_REPO="${WAREHOUSE_REPO:-$GITHUB_ROOT/warehouse-microservice}"
PAYMENTS_REPO="${PAYMENTS_REPO:-$GITHUB_ROOT/payments-microservice}"
MARKETING_REPO="${MARKETING_REPO:-$GITHUB_ROOT/marketing-microservice}"
STATEX_REPO="${STATEX_REPO:-$GITHUB_ROOT/statex}"
NAMESPACE="${NAMESPACE:-statex-apps}"
AUTH_HEALTH_CONSUMER_DEPLOYMENTS=(
  "marathon"
  "orders-microservice"
  "warehouse-microservice"
  "payments-microservice"
  "catalog-microservice"
  "shop-assistant"
  "marketing-microservice"
  "speakasap-api-gateway"
  "speakasap-user"
)
BOOTSTRAP_PLAN_REPOS=(
  "statex"
  "shop-assistant"
  "marketing-microservice"
  "catalog-microservice"
  "orders-microservice"
  "payments-microservice"
  "warehouse-microservice"
)
STATIC_INVENTORY_REPOS=("${BOOTSTRAP_PLAN_REPOS[@]}")

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
printf "Auth repo: %s\nMarathon repo: %s\nSpeakASAP repo: %s\nOrders repo: %s\nShop Assistant repo: %s\nCatalog repo: %s\nWarehouse repo: %s\nPayments repo: %s\nMarketing repo: %s\nStateX repo: %s\nNamespace: %s\n\n" "$AUTH_REPO" "$MARATHON_REPO" "$SPEAKASAP_REPO" "$ORDERS_REPO" "$SHOP_ASSISTANT_REPO" "$CATALOG_REPO" "$WAREHOUSE_REPO" "$PAYMENTS_REPO" "$MARKETING_REPO" "$STATEX_REPO" "$NAMESPACE"

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
  run_check "SpeakASAP service identity contract" bash -c 'cd "$1" && ./scripts/check-service-identity-contract.py --json-report /tmp/speakasap-service-identity-contract-readiness.json' _ "$SPEAKASAP_REPO"
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

if grep -Fq '"AUTH_ALLOWED_REDIRECT_ORIGINS": "*.alfares.cz,https://strilkove.cz,https://www.strilkove.cz"' "$AUTH_REPO/scripts/deploy.sh"; then
  pass "Auth deploy preserves School Committee callback allowlist"
else
  fail "Auth deploy preserves School Committee callback allowlist"
fi

printf "== Repo-local bootstrap plans ==\n"
missing_bootstrap_plan=0
for repo_name in "${BOOTSTRAP_PLAN_REPOS[@]}"; do
  plan_path="$GITHUB_ROOT/$repo_name/docs/orchestrator/2026-06-24-aos-auth-modernization-plan.md"
  if [ -f "$plan_path" ]; then
    printf "present %s\n" "$repo_name"
  else
    printf "missing %s\n" "$repo_name"
    missing_bootstrap_plan=1
  fi
done
if [ "$missing_bootstrap_plan" -eq 0 ]; then
  pass "repo-local bootstrap plans present"
else
  fail "repo-local bootstrap plans present"
fi

printf "== Repo-local static auth inventories ==\n"
missing_static_inventory=0
for repo_name in "${STATIC_INVENTORY_REPOS[@]}"; do
  inventory_path="$GITHUB_ROOT/$repo_name/docs/orchestrator/2026-06-24-aos-auth-static-inventory.md"
  if [ -f "$inventory_path" ]; then
    printf "present %s\n" "$repo_name"
  else
    printf "missing %s\n" "$repo_name"
    missing_static_inventory=1
  fi
done
if [ "$missing_static_inventory" -eq 0 ]; then
  pass "repo-local static auth inventories present"
else
  fail "repo-local static auth inventories present"
fi

if [ ! -d "$ORDERS_REPO" ]; then
  fail "Orders repo missing at $ORDERS_REPO"
else
  run_check "Orders hosted Auth admin UI verifier" bash -lc "cd '$ORDERS_REPO' && npm run verify:admin-operations-console"
  run_check "Orders Warehouse service JWT caller contract" bash -lc "cd '$ORDERS_REPO' && npm run verify:warehouse-handoff"
fi

if [ ! -d "$SHOP_ASSISTANT_REPO" ]; then
  fail "Shop Assistant repo missing at $SHOP_ASSISTANT_REPO"
else
  run_check "Shop Assistant hosted Auth static contract" bash -lc "cd '$SHOP_ASSISTANT_REPO' && npm run check:hosted-auth"
fi

if [ ! -d "$CATALOG_REPO" ]; then
  fail "Catalog repo missing at $CATALOG_REPO"
else
  run_check "Catalog AOS auth static contract" bash -lc "cd '$CATALOG_REPO' && npm run check:aos-auth-contract"
fi

if [ ! -d "$WAREHOUSE_REPO" ]; then
  fail "Warehouse repo missing at $WAREHOUSE_REPO"
else
  run_check "Warehouse hosted Auth static contract" bash -lc "cd '$WAREHOUSE_REPO' && npm run check:hosted-auth"
fi

if [ ! -d "$PAYMENTS_REPO" ]; then
  fail "Payments repo missing at $PAYMENTS_REPO"
else
  run_check "Payments hosted Auth static contract" bash -lc "cd '$PAYMENTS_REPO' && npm run check:hosted-auth"
fi

if [ ! -d "$MARKETING_REPO" ]; then
  fail "Marketing repo missing at $MARKETING_REPO"
else
  run_check "Marketing hosted Auth static contract" bash -lc "cd '$MARKETING_REPO' && npm run check:auth-static"
fi

if [ ! -d "$STATEX_REPO" ]; then
  fail "StateX repo missing at $STATEX_REPO"
else
  run_check "StateX hosted Auth static contract" bash -lc "cd '$STATEX_REPO' && node scripts/check-statex-hosted-auth-contract.js"
fi

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

  auth_service_port="$(kubectl -n "$NAMESPACE" get svc auth-microservice -o 'jsonpath={.spec.ports[?(@.name=="http")].port}' 2>/dev/null || true)"
  if [ "$auth_service_port" = "3370" ]; then
    pass "Auth Kubernetes service exposes http port 3370"
  else
    fail "Auth Kubernetes service http port is ${auth_service_port:-missing}; expected 3370"
  fi

  printf "== Runtime Auth /health reachability ==\n"
  auth_health_failures=0
  for deployment_name in "${AUTH_HEALTH_CONSUMER_DEPLOYMENTS[@]}"; do
    printf "%s " "$deployment_name"
    probe_output="$(
      kubectl -n "$NAMESPACE" exec "deploy/$deployment_name" -- node -e \
        'const c = new AbortController();
         setTimeout(() => c.abort(), 3000);
         fetch("http://auth-microservice:3370/health", { signal: c.signal })
           .then(async (r) => {
             const body = await r.text();
             if (r.status !== 200 || !body.includes("auth-microservice")) {
               console.error(`${r.status} ${body.slice(0, 120)}`);
               process.exit(2);
             }
             console.log(`200 ${body.slice(0, 120)}`);
           })
           .catch((error) => {
             console.error(`${error.name}:${error.message}`);
             process.exit(2);
           });' 2>&1
    )" || auth_health_failures=$((auth_health_failures + 1))
    printf "%s\n" "$probe_output" | sed -n '1,4p'
  done
  if [ "$auth_health_failures" -eq 0 ]; then
    pass "runtime Auth health reachable from consumer deployments"
  else
    fail "runtime Auth health reachable from consumer deployments"
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
