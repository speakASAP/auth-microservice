# Service Identity Consumer Standard

Status: **active standard — canonical, single point of truth**

This is the only normative document for service-to-service and HTTP
agent-to-agent authentication in Alfares. It defines machine identity, token
minting, validation, authorization, storage, and rotation. It is registered in
[`shared/docs/DOCUMENTATION_AUTHORITY.md`](../../shared/docs/DOCUMENTATION_AUTHORITY.md).

Human identity is a separate lane. For user-token validation use
[`CONSUMER_JWT_VALIDATION_STANDARD.md`](CONSUMER_JWT_VALIDATION_STANDARD.md);
for hosted login use
[`HOSTED_AUTH_CONSUMER_STANDARD.md`](HOSTED_AUTH_CONSUMER_STANDARD.md).

## Required protocol

Every HTTP call from one service to another uses an Auth-issued **RS256 service
JWT** in `Authorization: Bearer <token>`.

There is exactly one principal and credential for each `(caller -> target)`
pair. A credential must never be shared by callers or reused for another
target. Its identity is registered by Auth and has this shape:

```text
email: svc-<caller>--<target>@internal.alfares.cz
name:  <caller>--<target>
role:  internal:<target>:<least-privilege-role>
alg:   RS256
```

The role names the target service and expresses the smallest authority needed
for the call. A service token never receives `global:superadmin` and never
becomes a human user actor.

## Minting and delivery

Only Auth may sign a service token. Provision or re-mint it only with:

```bash
auth-microservice/scripts/provision-service-token.js
```

Use that script's confirmation gates and secure output handling. Before
minting, ensure the pair's principal and target role exist. Deliver the token
through the approved Vault -> ExternalSecret -> Kubernetes Secret ->
`secretKeyRef` path. Do not put credential material in a ConfigMap, source
tree, report, test fixture, command history, or logs.

## Receiver requirements

A receiver validates service JWTs through `POST /auth/validate` or an approved
local RS256 verifier. It creates a service actor that is distinct from a user
actor and includes the stable caller identity.

Every machine-accessible route declares its allowed service roles explicitly.
Classify by effect, not HTTP verb: a POST that only reads data requires a read
role. Define role sets as named constants, enforce them on every route, and
deny and error-log an undecorated route. A role claim that is not enforced does
not grant a safe authorization boundary.

## Caller requirements

The caller sends only its pair-specific bearer token over TLS and must not
construct, alter, decode into output, or log the credential. Credential
rotation is mandatory before the 90-day lifetime expires and after any Auth key
or principal change. A rotation is complete only after an authenticated call
to the receiver succeeds; expiry time, Secret synchronization, and pod restart
are not acceptance evidence.

## Non-HTTP transports

RabbitMQ publishers and consumers authenticate to the broker. A message does
not carry caller authority. A message handler that initiates a privileged
service action must make a separately authorized HTTP call under this standard.
CronJobs and CLI jobs are callers and need their own `(caller -> target)`
principal.

## Prohibited

Do not create a second service-token format, a shared service credential, a
self-signed service JWT, an API-key substitute, a self-asserted caller header,
or a principal without a revocable Auth record. Do not mix service credentials
with user access tokens or grant user roles from a service token.

If an integration cannot meet this contract, stop and repair the integration;
do not document an exception or alternative protocol.
