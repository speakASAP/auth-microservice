# Business: auth-microservice

> ⚠️ IMMUTABLE BY AI.

## Goal

Centralized JWT authentication and user management for all Statex services.

## Constraints

- AI must never expose or log JWT secrets
- Password hashing: bcrypt only
- No direct DB writes to user table by AI agents

## Consumers

All applications and most microservices.

## SLA

- Backend port: 3370 ([http://auth-microservice:3370](http://auth-microservice:3370))
- Frontend port: 3372
- Production: [https://auth.alfares.cz](https://auth.alfares.cz)
