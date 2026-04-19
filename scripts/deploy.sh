#!/bin/bash
# deploy.sh — Kubernetes deployment for auth-microservice
# Usage: ./scripts/deploy.sh [image-tag]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="auth-microservice"
NAMESPACE="statex-apps"
REGISTRY="localhost:5000"
IMAGE_TAG="${1:-latest}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"

# ═══════════════════════════════════════════════════════════
#  auth-microservice - Kubernetes Deployment
# ═══════════════════════════════════════════════════════════

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ${SERVICE_NAME}"
echo "║  Kubernetes Deployment"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Phase 1: Git sync (production only) ──────────────────────
if [ "${NODE_ENV}" = "production" ]; then
  echo -e "${YELLOW}[1/5] Syncing git...${NC}"
  cd "$PROJECT_ROOT"
  git fetch origin
  git stash
  git pull origin main
  git stash pop || true
  echo -e "${GREEN}✅ Git synced${NC}"
fi

# ── Phase 2: Build Docker image ──────────────────────────────
echo -e "${YELLOW}[2/5] Building image: ${IMAGE}...${NC}"
docker build -t "$IMAGE" "$PROJECT_ROOT"
echo -e "${GREEN}✅ Image built${NC}"

# ── Phase 3: Push to local registry ──────────────────────────
echo -e "${YELLOW}[3/5] Pushing to registry...${NC}"
docker push "$IMAGE"
echo -e "${GREEN}✅ Image pushed: ${IMAGE}${NC}"


# ── Phase 3b: ConfigMap + ExternalSecret (Vault-managed secrets) ──────────
echo -e "${YELLOW}[3b/5] Applying ConfigMap and ExternalSecret...${NC}"
CONFIGMAP_TEMPLATE="$PROJECT_ROOT/k8s/configmap.yaml.template"
if [ ! -f "$CONFIGMAP_TEMPLATE" ]; then
  echo -e "${RED}Missing ${CONFIGMAP_TEMPLATE}${NC}"
  exit 1
fi
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi
export K8S_NAMESPACE="${K8S_NAMESPACE:-statex-apps}"
# In-cluster URLs by default (Docker .env often uses public URLs; do not reuse those here).
export LOGGING_SERVICE_URL_FOR_K8S="${K8S_LOGGING_SERVICE_URL:-http://logging-microservice.statex-apps.svc.cluster.local:3367}"
export NOTIFICATION_SERVICE_URL_FOR_K8S="${K8S_NOTIFICATION_SERVICE_URL:-http://host.k3s.internal:3368}"
: "${GOOGLE_OAUTH_AUTH_URL:=https://accounts.google.com/o/oauth2/v2/auth}"
: "${GOOGLE_OAUTH_TOKEN_URL:=https://oauth2.googleapis.com/token}"
: "${GOOGLE_OAUTH_PROFILE_URL:=https://openidconnect.googleapis.com/v1/userinfo}"
: "${FACEBOOK_OAUTH_AUTH_URL:=https://www.facebook.com/v12.0/dialog/oauth}"
: "${FACEBOOK_OAUTH_TOKEN_URL:=https://graph.facebook.com/v12.0/oauth/access_token}"
: "${FACEBOOK_OAUTH_PROFILE_URL:=https://graph.facebook.com/me?fields=id,name,email}"
CONFIGMAP_VARS='${K8S_NAMESPACE}${NODE_ENV}${SERVICE_NAME}${DOMAIN}${PORT}${FRONTEND_PORT}${CORS_ORIGIN}${FRONTEND_URL}${AUTH_URL}${DB_HOST}${DB_PORT}${DB_USER}${DB_NAME}${DB_SYNC}${DB_AUTO_CREATE}${JWT_EXPIRES_IN}${JWT_REFRESH_EXPIRES_IN}${LOG_LEVEL}${LOGGING_SERVICE_URL_FOR_K8S}${NOTIFICATION_SERVICE_URL_FOR_K8S}${LOGS_VOLUME_PATH}${AUTH_ALLOWED_REDIRECT_ORIGINS}${AUTH_MAGIC_LINK_TTL_MINUTES}${AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP}${AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL}${AUTH_OAUTH_INIT_RATE_LIMIT_PER_IP}${AUTH_RATE_LIMIT_WINDOW_MS}${GOOGLE_OAUTH_AUTH_URL}${GOOGLE_OAUTH_TOKEN_URL}${GOOGLE_OAUTH_PROFILE_URL}${FACEBOOK_OAUTH_AUTH_URL}${FACEBOOK_OAUTH_TOKEN_URL}${FACEBOOK_OAUTH_PROFILE_URL}'
envsubst "${CONFIGMAP_VARS}" < "$CONFIGMAP_TEMPLATE" | kubectl apply -f -

# Secrets are managed by External Secrets Operator → Vault
kubectl apply -f "$PROJECT_ROOT/k8s/external-secret.yaml"
echo -e "${GREEN}ConfigMap / ExternalSecret applied (Vault-managed secrets)${NC}"


# ── Phase 4: Update K8s deployment ──────────────────────────
echo -e "${YELLOW}[4/5] Updating K8s deployment...${NC}"
kubectl set image deployment/${SERVICE_NAME} \
  app="${IMAGE}" \
  -n "${NAMESPACE}"
kubectl rollout status deployment/${SERVICE_NAME} \
  -n "${NAMESPACE}" \
  --timeout=120s
echo -e "${GREEN}✅ Rollout complete${NC}"

# ── Phase 5: Health check ────────────────────────────────────
echo -e "${YELLOW}[5/5] Verifying health...${NC}"
POD=$(kubectl get pod -n "${NAMESPACE}" \
  -l app=${SERVICE_NAME} \
  -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
  echo -e "${RED}❌ No pod found for ${SERVICE_NAME}${NC}"
  exit 1
fi

kubectl exec -n "${NAMESPACE}" "$POD" -- \
  wget -qO- http://localhost:3370/health || {
  echo -e "${RED}⚠️  Health check failed (service may still be starting)${NC}"
}
echo -e ""

# ── Done ─────────────────────────────────────────────────────
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║            ✅ Deployment successful!                   ║"
echo "║  Service:  ${SERVICE_NAME}"
echo "║  Image:    ${IMAGE}"
echo "║  Namespace: ${NAMESPACE}"
echo "║  Pods:     $(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} --no-headers | wc -l) running"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"
