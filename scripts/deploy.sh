#!/bin/bash
# deploy.sh — Kubernetes deployment for auth-microservice
# Usage: ./scripts/deploy.sh [image-tag]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="auth-microservice"
WEB_SERVICE_NAME="auth-microservice-web"
NAMESPACE="${K8S_NAMESPACE:-statex-apps}"
REGISTRY="localhost:5000"
# Always use timestamp so k3s pulls fresh image (same git hash across deploys skips pull)
DEFAULT_TAG="$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "build")-$(date -u +%Y%m%d%H%M%S)"
IMAGE_TAG="${1:-$DEFAULT_TAG}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"
WEB_IMAGE="${REGISTRY}/${WEB_SERVICE_NAME}:${IMAGE_TAG}"
WEB_IMAGE_LATEST="${REGISTRY}/${WEB_SERVICE_NAME}:latest"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log_info() {
  echo -e "[$(timestamp)] ${BLUE}[INFO]${NC} $*"
}

log_warn() {
  echo -e "[$(timestamp)] ${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "[$(timestamp)] ${RED}[ERROR]${NC} $*"
}

# ═══════════════════════════════════════════════════════════
#  auth-microservice - Kubernetes Deployment
# ═══════════════════════════════════════════════════════════

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║        auth-microservice - Kubernetes Deployment       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Phase 1: Git sync (production only) ──────────────────────
if [ "${NODE_ENV:-}" = "production" ]; then
  log_info "[1/6] Syncing git..."
  cd "$PROJECT_ROOT"
  git fetch origin
  git stash
  git pull origin main
  git stash pop || true
  echo -e "${GREEN}✅ Git synced${NC}"
fi

# ── Phase 2: Build Docker images ──────────────────────────────
log_info "[2/6] Building backend image: ${IMAGE}..."
docker build --no-cache -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT"
echo -e "${GREEN}✅ Backend image built${NC}"

log_info "[2b/6] Building web frontend image: ${WEB_IMAGE}..."
docker build -t "$WEB_IMAGE" -t "$WEB_IMAGE_LATEST" "$PROJECT_ROOT/web"
echo -e "${GREEN}✅ Web image built${NC}"

# ── Phase 3: Push to local registry ──────────────────────────
log_info "[3/6] Pushing images to registry..."
docker push "$IMAGE"
docker push "$IMAGE_LATEST"
docker push "$WEB_IMAGE"
docker push "$WEB_IMAGE_LATEST"
echo -e "${GREEN}✅ Images pushed: ${IMAGE}, ${WEB_IMAGE}${NC}"

# ── Phase 3b: ConfigMap + ExternalSecret (Vault-managed secrets) ──────────
log_info "[3b/6] Applying ConfigMap and ExternalSecret..."
CONFIGMAP_TEMPLATE="$PROJECT_ROOT/k8s/configmap.yaml.template"
if [ ! -f "$CONFIGMAP_TEMPLATE" ]; then
  log_error "Missing ${CONFIGMAP_TEMPLATE}"
  exit 1
fi
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi
export K8S_NAMESPACE="${NAMESPACE}"
# In-cluster URLs by default (Docker .env often uses public URLs; do not reuse those here).
export LOGGING_SERVICE_URL_FOR_K8S="${K8S_LOGGING_SERVICE_URL:-http://logging-microservice.statex-apps.svc.cluster.local:3367}"
export NOTIFICATION_SERVICE_URL_FOR_K8S="${K8S_NOTIFICATION_SERVICE_URL:-http://notifications-microservice.statex-apps.svc.cluster.local:3368}"
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

# ── Phase 3c: Apply deployment manifests (drift-safe) ──────────────────────
log_info "[3c/6] Applying Kubernetes manifests (deployment/service/ingress)..."
kubectl apply -f "$PROJECT_ROOT/k8s/deployment.yaml" -n "${NAMESPACE}"
kubectl apply -f "$PROJECT_ROOT/k8s/service.yaml" -n "${NAMESPACE}"
kubectl apply -f "$PROJECT_ROOT/k8s/deployment-web.yaml" -n "${NAMESPACE}"
kubectl apply -f "$PROJECT_ROOT/k8s/service-web.yaml" -n "${NAMESPACE}"
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml" -n "${NAMESPACE}"
echo -e "${GREEN}✅ Manifests applied${NC}"

# ── Phase 3d: Validate ESO/Secret status (do not hide root causes) ─────────
log_info "[3d/6] Validating Vault ExternalSecret status..."
if ! kubectl get clustersecretstore vault-backend -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' | rg -q "^True$"; then
  log_error "ClusterSecretStore 'vault-backend' is not Ready."
  kubectl get clustersecretstore vault-backend -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}' || true
  echo
  exit 1
fi
if ! kubectl get externalsecret auth-microservice-secret -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' | rg -q "^True$"; then
  log_error "ExternalSecret 'auth-microservice-secret' is not Ready."
  kubectl describe externalsecret auth-microservice-secret -n "${NAMESPACE}" || true
  exit 1
fi
echo -e "${GREEN}✅ Vault ExternalSecret is Ready${NC}"

# ── Phase 4: Update K8s deployments ──────────────────────────
log_info "[4/6] Updating K8s deployment images..."
kubectl set image deployment/${SERVICE_NAME} app="${IMAGE}" -n "${NAMESPACE}"
kubectl set image deployment/${WEB_SERVICE_NAME} app="${WEB_IMAGE}" -n "${NAMESPACE}"
kubectl rollout status deployment/${SERVICE_NAME} -n "${NAMESPACE}" --timeout=120s
kubectl rollout status deployment/${WEB_SERVICE_NAME} -n "${NAMESPACE}" --timeout=120s
echo -e "${GREEN}✅ Rollout complete${NC}"

# ── Phase 5: Health check ────────────────────────────────────
log_info "[5/6] Verifying pod health..."
sleep 3
POD=$(kubectl get pod -n "${NAMESPACE}" \
  -l app=${SERVICE_NAME} \
  -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
  log_error "No pod found for ${SERVICE_NAME}"
  exit 1
fi

kubectl exec -n "${NAMESPACE}" "$POD" -- \
  node -e "require('http').get('http://localhost:3370/health',(r)=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>{process.stdout.write(b+'\n')})}).on('error',()=>process.exit(1))" || {
  log_warn "Health check failed (service may still be starting)."
}
echo -e ""

# ── Post-deploy: enforce production overrides not in .env ────
# strilkove.cz must be an allowed redirect origin; rate window is 60s not 15m
kubectl patch configmap auth-microservice-config -n "${NAMESPACE}" --type=merge -p '{
  "data": {
    "AUTH_ALLOWED_REDIRECT_ORIGINS": "*.alfares.cz,https://strilkove.cz",
    "AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP": "100",
    "AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL": "50",
    "AUTH_RATE_LIMIT_WINDOW_MS": "60000"
  }
}' && kubectl rollout restart deployment/${SERVICE_NAME} -n "${NAMESPACE}" && \
  kubectl rollout status deployment/${SERVICE_NAME} -n "${NAMESPACE}" --timeout=120s

# ── Done ─────────────────────────────────────────────────────
log_info "[6/6] Deployment workflow complete."
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║       ✅ Auth Microservice Deployment successful!      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo "Image:    ${IMAGE}"
echo "Namespace: ${NAMESPACE}"
echo "Pods:     $(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} --no-headers | wc -l) running"
echo -e "${NC}"
