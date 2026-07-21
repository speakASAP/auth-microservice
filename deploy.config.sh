# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 (Phase D) for the design.
# scripts/deploy.sh is still the live, authoritative deploy path.
#
# Real order: contract test -> build both images -> push -> apply templated
# ConfigMap + ExternalSecret -> apply deployment/service (x2) + ingress ->
# validate ExternalSecret is Ready -> set images -> wait -> health check
# (best-effort) -> post-deploy ConfigMap patch + restart. The templated
# ConfigMap apply doesn't depend on build/push, so it runs in deploy_preflight
# (before Build, which is harmless -- it just needs to exist before
# deployment.yaml references it, which happens much later). ExternalSecret
# validation runs in deploy_post_manifests to match the real script's
# position (after manifests, before set-image).

SERVICE_NAME="auth-microservice"
PORT="3370"

IMAGES=(
  "auth-microservice|.|Dockerfile|--no-cache"
  "auth-microservice-web|web||"
)

DEPLOYMENTS=(
  "auth-microservice|app|auth-microservice"
  "auth-microservice-web|app|auth-microservice-web"
)

MANIFESTS=(deployment.yaml service.yaml deployment-web.yaml service-web.yaml ingress.yaml)

deploy_preflight() {
  ( cd "$PROJECT_ROOT" && npm run test:auth-contract )

  local configmap_template="$PROJECT_ROOT/k8s/configmap.yaml.template"
  if [ ! -f "$configmap_template" ]; then
    echo "Missing ${configmap_template}" >&2
    return 1
  fi
  if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/.env"
    set +a
  fi
  export K8S_NAMESPACE="${NAMESPACE}"
  export LOGGING_SERVICE_URL_FOR_K8S="${K8S_LOGGING_SERVICE_URL:-http://logging-microservice.statex-apps.svc.cluster.local:3367}"
  export NOTIFICATION_SERVICE_URL_FOR_K8S="${K8S_NOTIFICATION_SERVICE_URL:-http://notifications-microservice.statex-apps.svc.cluster.local:3368}"
  : "${GOOGLE_OAUTH_AUTH_URL:=https://accounts.google.com/o/oauth2/v2/auth}"
  : "${GOOGLE_OAUTH_TOKEN_URL:=https://oauth2.googleapis.com/token}"
  : "${GOOGLE_OAUTH_PROFILE_URL:=https://openidconnect.googleapis.com/v1/userinfo}"
  : "${FACEBOOK_OAUTH_AUTH_URL:=https://www.facebook.com/v12.0/dialog/oauth}"
  : "${FACEBOOK_OAUTH_TOKEN_URL:=https://graph.facebook.com/v12.0/oauth/access_token}"
  : "${FACEBOOK_OAUTH_PROFILE_URL:=https://graph.facebook.com/me?fields=id,name,email}"
  # EP-005 W3. Two things are required and neither is obvious:
  #   - it must be listed in configmap_vars below, because envsubst uses an explicit allow-list
  #     and leaves an unlisted variable as the literal string "${RABBITMQ_URL}";
  #   - it must be *exported*. envsubst reads the environment, not the shell, so the
  #     `: "${VAR:=default}"` form used above only works for variables that .env already exported
  #     under `set -a`. A default set that way for a variable absent from .env silently
  #     substitutes to empty — which is what happened on the first W3 deploy.
  export RABBITMQ_URL="${RABBITMQ_URL:-amqp://guest:guest@rabbitmq.statex-apps.svc.cluster.local:5672}"
  local configmap_vars='${K8S_NAMESPACE}${NODE_ENV}${SERVICE_NAME}${DOMAIN}${PORT}${FRONTEND_PORT}${CORS_ORIGIN}${FRONTEND_URL}${AUTH_URL}${DB_HOST}${DB_PORT}${DB_USER}${DB_NAME}${DB_SYNC}${DB_AUTO_CREATE}${JWT_EXPIRES_IN}${JWT_REFRESH_EXPIRES_IN}${LOG_LEVEL}${LOGGING_SERVICE_URL_FOR_K8S}${NOTIFICATION_SERVICE_URL_FOR_K8S}${LOGS_VOLUME_PATH}${AUTH_ALLOWED_REDIRECT_ORIGINS}${AUTH_MAGIC_LINK_TTL_MINUTES}${AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP}${AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL}${AUTH_OAUTH_INIT_RATE_LIMIT_PER_IP}${AUTH_RATE_LIMIT_WINDOW_MS}${AUTH_CONTACT_CODE_PHONE_CHANNEL}${AUTH_CONTACT_CODE_PHONE_CHANNEL_KEY}${AUTH_CONTACT_CODE_EMAIL_CHANNEL_KEY}${GOOGLE_OAUTH_AUTH_URL}${GOOGLE_OAUTH_TOKEN_URL}${GOOGLE_OAUTH_PROFILE_URL}${FACEBOOK_OAUTH_AUTH_URL}${FACEBOOK_OAUTH_TOKEN_URL}${FACEBOOK_OAUTH_PROFILE_URL}${RABBITMQ_URL}'
  envsubst "$configmap_vars" < "$configmap_template" | kubectl apply -f -
  kubectl apply -f "$PROJECT_ROOT/k8s/external-secret.yaml"
}

deploy_post_manifests() {
  if ! kubectl get clustersecretstore vault-backend -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' | grep -qx "True"; then
    echo "ClusterSecretStore 'vault-backend' is not Ready." >&2
    kubectl get clustersecretstore vault-backend -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}' >&2 || true
    return 1
  fi
  if ! kubectl get externalsecret auth-microservice-secret -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' | grep -qx "True"; then
    echo "ExternalSecret 'auth-microservice-secret' is not Ready." >&2
    kubectl describe externalsecret auth-microservice-secret -n "$NAMESPACE" >&2 || true
    return 1
  fi
}

deploy_post_verify() {
  local pod
  pod=$(kubectl get pod -n "$NAMESPACE" -l app="$SERVICE_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [ -n "$pod" ]; then
    kubectl exec -n "$NAMESPACE" "$pod" -- \
      node -e "require('http').get('http://localhost:3370/health',(r)=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>{process.stdout.write(b+'\n')})}).on('error',()=>process.exit(1))" \
      || echo "Health check failed (service may still be starting)." >&2
  fi

  kubectl patch configmap auth-microservice-config -n "$NAMESPACE" --type=merge -p '{
    "data": {
      "AUTH_ALLOWED_REDIRECT_ORIGINS": "*.alfares.cz,https://strilkove.cz,https://www.strilkove.cz",
      "AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP": "100",
      "AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL": "50",
      "AUTH_RATE_LIMIT_WINDOW_MS": "60000",
      "AUTH_CONTACT_CODE_PHONE_CHANNEL": "whatsapp"
    }
  }'
  kubectl rollout restart deployment/"$SERVICE_NAME" -n "$NAMESPACE"
  deploy_timing_k8s_rollout_wait kubectl "$SERVICE_NAME" "$NAMESPACE"
}
