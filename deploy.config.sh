# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6 for the design.
#
# Phase A validation target for the multi-image case (report section 7).
# auth-microservice is explicitly Phase D material (report section 7: "these
# need hooks; treat each as its own review") — scripts/deploy.sh remains the
# live, authoritative deploy path. This config models the generic phases
# (contract-test preflight, two-image build, apply, set-image, rollout wait)
# faithfully enough for --dry-run to prove the runner mechanics; it does NOT
# yet model the envsubst-templated ConfigMap or the post-deploy config patch
# (hardcoded redirect-origin / rate-limit values) that the real script does.
# Those become deploy_post_verify (or a new hook, if one is needed) only when
# this service actually migrates — not before.

SERVICE_NAME="auth-microservice"
PORT="3370"

# image[i] = "image-name|build-context|dockerfile|extra-docker-args"
IMAGES=(
  "auth-microservice|.|Dockerfile|--no-cache"
  "auth-microservice-web|web||"
)

# deployment[i] = "k8s-deployment|container|image-name"
DEPLOYMENTS=(
  "auth-microservice|app|auth-microservice"
  "auth-microservice-web|app|auth-microservice-web"
)

# Real script's manifest set for the parts this config models (excludes the
# templated configmap.yaml.template, applied separately with envsubst).
MANIFESTS=(deployment.yaml service.yaml deployment-web.yaml service-web.yaml ingress.yaml)

deploy_preflight() {
  npm run test:auth-contract --prefix "$PROJECT_ROOT"
}
