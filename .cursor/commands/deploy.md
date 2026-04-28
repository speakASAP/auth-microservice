# Deploy auth-microservice

```bash
# Standard deploy (blue/green via nginx-microservice):
./scripts/deploy.sh

# Or directly from nginx-microservice:
./scripts/blue-green/deploy-smart.sh auth-microservice
```

**Verify:** `curl http://auth-microservice:3370/health` → `{"status":"ok"}`

See [`shared/docs/DEPLOY_STANDARD.md`](../../shared/docs/DEPLOY_STANDARD.md) for deploy conventions.
