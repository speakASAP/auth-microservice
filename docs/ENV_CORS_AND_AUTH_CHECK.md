# CORS and Auth URL check (.env)

## Summary

- **auth-microservice**: Must set `CORS_ORIGIN` to a **comma-separated list** of allowed origins (not `*`) so admin logins from logging, notifications, database-server work. Port is `3370` (internal).
- **Other services**: Use `AUTH_SERVICE_URL=http://auth-microservice:3370` for server-side calls; use `AUTH_SERVICE_PUBLIC_URL=https://auth.<domain>` where the browser needs to call auth (e.g. admin login).

---

## Local (/Users/sergiystashok/Documents/GitHub)

| Repo | CORS | Auth URL / port | Status |
|------|------|-----------------|--------|
| **auth-microservice** | `CORS_ORIGIN` | PORT=3370 | Set `CORS_ORIGIN` to comma-separated list for prod-style; use `*` only for local dev. |
| logging-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=https://auth.alfares.cz | OK (frontend build uses public URL). |
| notifications-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=http://auth-microservice:3370, AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz | OK. |
| database-server | — | AUTH_SERVICE_URL=http://auth-microservice:3370, AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz | OK. |
| marathon, payments, allegro, flipflop, speakasap, leads, beauty, warehouse, catalog, crypto-ai-agent | Each has own CORS_ORIGIN and AUTH_SERVICE_URL=http://auth-microservice:3370 | OK. |
| statex | CORS_ORIGIN, AUTH_SERVICE_URL=https://auth.alfares.cz | OK (public URL for browser). |
| bazos, aukro, heureka | AUTH_SERVICE_URL=http://auth-microservice:3370, CORS_ORIGIN= empty | Set CORS_ORIGIN to their public domain(s) if they have a web UI. |

---

## Prod: statex (ssh statex, ~/ = /home/statex)

| Repo | CORS | Auth URL | Issue / fix |
|------|------|----------|-------------|
| **auth-microservice** | CORS_ORIGIN=* | PORT=3370 | **Fix:** Set `CORS_ORIGIN=https://auth.alfares.cz,https://loggingalfares.czcz,https://notificationalfares.cz.cz,https://database-servalfares.czs.cz` then recreate backend. |
| logging-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=https://auth.alfares.cz | OK. |
| notifications-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=http://auth-microservice:3370, AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz | OK. |
| database-server | — | AUTH_SERVICE_URL=http://auth-microservice:3370, AUTH_SERVICE_PUBLIC_URL=https://auth.alfares.cz | OK. |
| marathon, payments, allegro, flipflop, speakasap, leads, beauty, warehouse, catalog | Correct CORS_ORIGIN and AUTH_SERVICE_URL=http://auth-microservice:3370 | OK. |
| statex | AUTH_SERVICE_URL=https://auth.alfares.cz | OK. |
| crypto-ai-agent | CORS_ORIGINS=..., AUTH_SERVICE_URL=http://auth-microservice:3370 | OK. |

**On statex, run (after backup):**
```bash
cd ~/auth-microservice
cp .env .env.bak.$(date +%Y%m%d)
# Edit .env: set
# CORS_ORIGIN=https://auth.alfares.cz,https://loggingalfares.czcz,https://notificationalfares.cz.cz,https://database-servalfares.czs.cz
sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://auth.alfares.cz,https://loggingalfares.czcz,https://notificationalfares.cz.cz,https://database-servalfares.czs.cz|' .env
docker compose -f docker-compose.blue.yml up -d --force-recreate backend
```

---

## Prod: sgipreal (ssh sgipreal, ~/ = /home/belunga)

| Repo | CORS | Auth URL | Issue / fix |
|------|------|----------|-------------|
| **auth-microservice** | CORS_ORIGIN=* | PORT=3370 | **Fix:** Set `CORS_ORIGIN=https://auth.sgipreal.com,https://logging.sgipreal.com,https://database-server.sgipreal.com` then recreate backend. |
| logging-microservice | CORS_ORIGIN=* | AUTH_SERVICE_URL=https://auth.sgipreal.com | OK. |
| database-server | — | AUTH_SERVICE_URL=http://auth-microservice:3370, AUTH_SERVICE_PUBLIC_URL=https://auth.sgipreal.com | OK. |
| sgiprealestate | (no AUTH in .env) | — | OK if it does not call auth. |

**On sgipreal, run (after backup):**
```bash
cd ~/auth-microservice
cp .env .env.bak.$(date +%Y%m%d)
# Edit .env: set
# CORS_ORIGIN=https://auth.sgipreal.com,https://logging.sgipreal.com,https://database-server.sgipreal.com
sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://auth.sgipreal.com,https://logging.sgipreal.com,https://database-server.sgipreal.com|' .env
docker compose -f docker-compose.blue.yml up -d --force-recreate backend
```

---

## Port reference

- Auth backend (internal): **3370** (`http://auth-microservice:3370`).
- Public auth URL (browser): **https://auth.alfares.cz** or **https://auth.sgipreal.com** (no port in URL).
