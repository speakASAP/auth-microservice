> **PENDING** — Admin routing fix not yet applied. See plan below.

---

## Auth Admin Panel Fix Plan (`auth.alfares.cz/admin`)

### Goals

- Restore **Auth backend status** in admin panel (no more `Cannot GET /api/health-backend`).
- Restore **Logging status & recent activity** using the centralized logging microservice.
- Avoid direct nginx-microservice changes; use **auth-microservice web layer** and existing deployment scripts.

### Tasks

- ✅ **Read documentation**
  - `auth-microservice/README.md`
  - `auth-microservice/docs/ENV_CORS_AND_AUTH_CHECK.md`
  - `nginx-microservice/README.md` and `docs/SERVICE_REGISTRY.md`
- ✅ **Diagnose current issue**
  - Confirm admin JS calls: `/api/health-backend` and `/api/stats`.
  - Confirm web server routes exist locally and on prod (`web/server.js`).
  - Verify that:
    - `https://auth.alfares.cz/health` returns backend health JSON.
    - `https://auth.alfares.cz/api/health-backend` and `/api/stats` return 404 from backend (`NestJS`), not from the web server.
  - Root cause: **nginx routes `/api/`* to backend**, so admin calls never reach the web container.
- ✅ **Confirm environment configuration**
  - Check `~/auth-microservice/.env` on prod:
    - `DOMAIN=auth.alfares.cz`
    - `SERVICE_NAME=auth-microservice`
    - `PORT=3370`
    - `CORS_ORIGIN` includes `auth.alfares.cz`, `loggingalfares.czcz`, `notificationalfares.cz.cz`, `database-servalfares.czs.cz`.
    - `LOGGING_SERVICE_URL=https://logging.alfares.cz`.
  - Conclusion: **env is correctly set**; the problem is purely routing.
- **Adjust web server routing (local code)**
  - Update `web/server.js` to serve admin APIs on paths that bypass nginx `/api/`* routing:
    - Expose both:
      - `/api/stats` **and** `/admin-api/stats`.
      - `/api/health-backend` **and** `/admin-api/health-backend`.
  - Keep existing `/api/`* routes for local/dev compatibility.
- **Update admin frontend JS (local code)**
  - Change `web/public/js/admin.js` to call:
    - `/admin-api/health-backend` instead of `/api/health-backend`.
    - `/admin-api/stats?...` instead of `/api/stats?...`.
  - This ensures browser calls hit the **web container** via root path, not the backend via `/api/`*.
- **Local verification (optional)**
  - Run auth-microservice web locally (or via Docker) and verify:
    - `/admin` loads correctly.
    - `/admin-api/health-backend` returns backend health JSON.
    - `/admin-api/stats` returns data (when logging service is reachable).
- **Deploy to production (after user commits & pushes)**
  - On local dev:
    - Review changes, run linters/tests if available.
    - Commit and push from `auth-microservice` (user action, no auto-commit).
  - On prod (`ssh alfares`):
    - `cd ~/auth-microservice`
    - (Optional) `cp .env .env.bak.$(date +%Y%m%d)` – env already correct.
    - `./scripts/deploy.sh`
- **Post-deploy verification**
  - Open `https://auth.alfares.cz/admin`:
    - **Auth backend** status shows `OK`.
    - **Logging** status shows `OK` when logs exist, otherwise `Not configured` / `No data` but no 404 errors.
    - Recent activity table is populated when there are recent logs for `auth-microservice`.
- **Documentation update**
  - Add a short note to `auth-microservice/README.md` under *Web Interface* explaining:
    - Admin panel now uses `/admin-api/`* routes for health and logging stats.
    - `/api/*` is reserved for backend and may be routed by nginx to the NestJS API.
