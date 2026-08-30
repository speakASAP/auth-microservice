# Auth Microservice


## Status
Production identity and access service; IPS planning adoption is complete.

## Documentation Authority
BUSINESS.md, SYSTEM.md, and docs/UNIFIED_AUTH_CONTRACT.md are authoritative.

## Capabilities
Registration, login, JWT refresh and validation, RBAC, OAuth, magic links, password recovery, and user preferences.

## Interfaces
Backend http://auth-microservice:3370; frontend https://auth.alfares.cz; health GET /health.

## Development
NestJS and Express use PostgreSQL, Redis, and bcrypt; read AGENTS.md before work.

## Configuration
Vault through ESO supplies auth-microservice-secret; never expose JWT or credential material.

## Deployment
Runs in the statex-apps namespace through the repository deployment workflow.

## Health and Observability
Kubernetes probes use GET /health and operational logging uses logging-microservice.
