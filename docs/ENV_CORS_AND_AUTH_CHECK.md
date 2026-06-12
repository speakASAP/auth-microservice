# CORS and Auth URL Reference

This document replaces the historical CORS runbook that DocsRAG still references. It records current Auth URL, redirect, and CORS contracts without embedding secrets.

## Runtime Sources

Production configuration is managed through Vault, External Secrets Operator, K8s Secrets, and the rendered Auth ConfigMap.

- Vault path: `secret/prod/auth-microservice`
- K8s namespace: `statex-apps`
- K8s Secret: `auth-microservice-secret`
- K8s ConfigMap: `auth-microservice-config`
- Backend internal URL: `http://auth-microservice:3370`
- Public frontend/API URL: `https://auth.alfares.cz`

Never write secret values into this repository. Document keys only.

## CORS

Auth backend CORS is controlled by `CORS_ORIGIN`.

Allowed formats:

- Explicit origins, for example `https://auth.alfares.cz,https://logging.alfares.cz`
- Wildcard suffixes, for example `*.alfares.cz`

Behavior:

- Empty `CORS_ORIGIN`: `origin: *`, `credentials: false`; acceptable only for local/development style operation.
- Non-empty `CORS_ORIGIN`: exact/wildcard matching is enforced and credentials are enabled.
- Production should use explicit known origins or scoped wildcard suffixes, never a broad wildcard with credentials.

## Redirect Allowlist

Cross-domain OAuth and magic-link redirects are controlled by `AUTH_ALLOWED_REDIRECT_ORIGINS`.

Rules implemented by `AuthService.validateReturnUrl`:

- `return_url` must be an absolute URL.
- `return_url` must use `https:`.
- If `AUTH_ALLOWED_REDIRECT_ORIGINS` is populated, `return_url.origin` must match an entry.
- Entries beginning with `*.` allow subdomain suffix matching.

If the allowlist is empty, code currently permits any HTTPS URL. Production should keep this value populated.

## Auth URLs for Consumers

Server-side services should use the in-cluster URL when they need to call Auth from Kubernetes:

```text
AUTH_SERVICE_URL=http://auth-microservice:3370
```

Browser-facing applications should send users to the public Auth URL:

```text
AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz
```

## Useful Checks

Run these from the remote host when validating production configuration:

```bash
kubectl get configmap -n statex-apps auth-microservice-config -o yaml
kubectl get secret -n statex-apps auth-microservice-secret -o jsonpath='{.data}' | jq 'keys'
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/login
curl -I -H 'Cache-Control: no-cache' https://auth.alfares.cz/admin
```

Do not print decoded secret values in shared logs or documentation.

## Historical Note

The old file contained stale hostnames and an obsolete Docker Compose remediation. Current production is K8s-managed; use `scripts/deploy.sh` and the rendered K8s manifests instead.
