# CORS and Auth URL Reference

> **K8s managed** — `CORS_ORIGIN` and `AUTH_SERVICE_URL` are in K8s ConfigMap synced from Vault.
> To update: see [`../shared/docs/VAULT.md`](../../shared/docs/VAULT.md) · path `secret/prod/auth-microservice`.

## Rules

- `auth-microservice` backend: `CORS_ORIGIN` = comma-separated allowed origins (never `*` in production)
- Other services (server-side calls): `AUTH_SERVICE_URL=http://auth-microservice:3370`
- Other services (browser-facing): `AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz`

## Production CORS_ORIGIN (statex)

<https://auth.alfares.cz,https://logging.alfares.cz,https://notifications.alfares.cz,https://database-server.alfares.cz>

## Port Reference

## Prod: statex (ssh statex, ~/ = /home/statex)

| Repo | CORS | Auth URL | Issue / fix |
| ---- | ---- | -------- | ----------- |
| **auth-microservice** | CORS_ORIGIN=* | PORT=3370 | **Fix:** Set `CORS_ORIGIN=https://auth.alfares.cz,https://loggingalfares.czcz,https://notificationalfares.cz.cz,https://database-servalfares.czs.cz` then recreate backend. |
| logging-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=<https://auth.alfares.cz> | OK. |
| notifications-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=<http://auth-microservice:3370>, AUTH_SERVICE_PUBLIC_URL=<https://auth.alfares.cz> | OK. |
| database-server | — | AUTH_SERVICE_URL=<http://auth-microservice:3370>, AUTH_SERVICE_PUBLIC_URL=<https://auth.alfares.cz> | OK. |
| marathon, payments, allegro, flipflop, speakasap, leads, beauty, warehouse, catalog | Correct CORS_ORIGIN and AUTH_SERVICE_URL=<http://auth-microservice:3370> | OK. |
| statex | AUTH_SERVICE_URL=<https://auth.alfares.cz> | OK. |
| crypto-ai-agent | CORS_ORIGINS=..., AUTH_SERVICE_URL=<http://auth-microservice:3370> | OK. |

**On statex, run (after backup):**

```bash
cd ~/auth-microservice
cp .env .env.bak.$(date +%Y%m%d)
# Edit .env: set

# CORS_ORIGIN=https://auth.alfares.cz,https://loggingalfares.czcz,https://notificationalfares.cz.cz,https://database-servalfares.czs.cz
sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://auth.alfares.cz,https://loggingalfares.czcz,https://notificationalfares.cz.cz,https://database-servalfares.czs.cz|' .env

docker compose -f docker-compose.blue.yml up -d --force-recreate backend
```
