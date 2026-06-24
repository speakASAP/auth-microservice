#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  "docs/UNIFIED_AUTH_CONTRACT.md"
  "docs/HOSTED_AUTH_CONSUMER_STANDARD.md"
  "docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md"
  "docs/orchestrator/2026-06-24-ecosystem-hosted-auth-rollout-index.md"
  "docs/orchestrator/2026-06-24-ecosystem-auth-rollout-product-education.md"
  "docs/orchestrator/2026-06-24-ecosystem-auth-rollout-commerce.md"
  "docs/orchestrator/2026-06-24-ecosystem-auth-rollout-platform-ops.md"
)

unified_contract_markers=(
  "GET /login"
  "GET /register"
  "client_id"
  "return_url"
  "access_token"
  "refresh_token"
  "state"
  "POST /auth/validate"
)

consumer_standard_markers=(
  "https://auth.alfares.cz/login"
  "https://auth.alfares.cz/register"
  "client_id"
  "return_url"
  "access_token"
  "refresh_token"
  "state"
  "POST /auth/validate"
  "speakasap-portal"
  "legacy"
  "Validation Checklist For Consumer Workers"
)

service_identity_markers=(
  "x-internal-service-token"
  "x-service-name"
  "service actor"
  "not human identity"
  "not Auth RBAC"
  "SERVICE_IDENTITY_CONSUMER_STANDARD"
  "redaction evidence"
)

missing=0

for rel_path in "${required_files[@]}"; do
  path="$REPO_ROOT/$rel_path"
  if [ ! -f "$path" ]; then
    printf "FAIL missing required rollout doc: %s\n" "$rel_path" >&2
    missing=1
    continue
  fi

  case "$rel_path" in
    docs/UNIFIED_AUTH_CONTRACT.md)
      for marker in "${unified_contract_markers[@]}"; do
        if ! grep -Fq "$marker" "$path"; then
          printf "FAIL %s missing marker: %s\n" "$rel_path" "$marker" >&2
          missing=1
        fi
      done
      ;;
    docs/HOSTED_AUTH_CONSUMER_STANDARD.md)
      for marker in "${consumer_standard_markers[@]}"; do
        if ! grep -Fq "$marker" "$path"; then
          printf "FAIL %s missing consumer-standard marker: %s\n" "$rel_path" "$marker" >&2
          missing=1
        fi
      done
      ;;
    docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md)
      for marker in "${service_identity_markers[@]}"; do
        if ! grep -Fq "$marker" "$path"; then
          printf "FAIL %s missing service-identity marker: %s\n" "$rel_path" "$marker" >&2
          missing=1
        fi
      done
      ;;
    docs/orchestrator/2026-06-24-ecosystem-hosted-auth-rollout-index.md)
      for marker in \
        "Commerce/marketplace" \
        "Platform/ops/admin" \
        "Product/education/public apps" \
        "Wave 1 - Consumer UI Redirects" \
        "Wave 2 - Backend Validation Standardization" \
        "Wave 3 - User Identity Backfill And Reconciliation" \
        "Do not touch legacy" \
        "docs/HOSTED_AUTH_CONSUMER_STANDARD.md"; do
        if ! grep -Fq "$marker" "$path"; then
          printf "FAIL %s missing rollout index marker: %s\n" "$rel_path" "$marker" >&2
          missing=1
        fi
      done
      ;;
    docs/orchestrator/2026-06-24-ecosystem-auth-rollout-*.md)
      for marker in "IPS Chain" "Parallel" "Allowed files" "Forbidden files" "Validation" "speakasap-portal"; do
        if ! grep -Fq "$marker" "$path"; then
          printf "FAIL %s missing handoff marker: %s\n" "$rel_path" "$marker" >&2
          missing=1
        fi
      done
      ;;
  esac
done

if grep -R "hosted Auth return parameter contract\\|hosted Auth browser session contract\\|hosted Auth callback token transport contract: hash vs query vs form_post" \
  "$REPO_ROOT/docs/orchestrator/2026-06-24-ecosystem-"*.md >/tmp/aos-hosted-auth-rollout-stale-markers.txt 2>/dev/null; then
  printf "FAIL stale hosted Auth missing-contract markers remain:\n" >&2
  sed -n "1,80p" /tmp/aos-hosted-auth-rollout-stale-markers.txt >&2
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  exit 1
fi

printf "Ecosystem hosted Auth rollout docs are present and reference the active hosted Auth contract.\n"
