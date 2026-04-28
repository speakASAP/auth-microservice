# CORS and Auth URL Reference

> **K8s managed** — `CORS_ORIGIN` and `AUTH_SERVICE_URL` are in K8s ConfigMap synced from Vault.
> To update: see [`../shared/docs/VAULT.md`](../../shared/docs/VAULT.md) · path `secret/prod/auth-microservice`.

## Rules

- `auth-microservice` backend: `CORS_ORIGIN` = comma-separated allowed origins (never `*` in production)
- Other services (server-side calls): `AUTH_SERVICE_URL=http://auth-microservice:3370`
- Other services (browser-facing): `AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz`

## Production CORS_ORIGIN (statex)

```
https://auth.alfares.cz,https://logging.alfares.cz,https://notifications.alfares.cz,https://database-server.alfares.cz
```

## Port Reference

- Internal: `http://auth-microservice:3370`
- Public: `https://auth.alfares.cz`
