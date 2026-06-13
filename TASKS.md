# Tasks: auth-microservice

## Backlog

- Owner-select or implement next RBAC remediation chunk: RBAC-REM-07 Logging admin role-enforcement verification (priority: 3)

## Completed

- Added admin access-token copy UX without requiring token reveal
- Added Auth intent preservation orchestrator pack under `docs/orchestrator/`
- Deployed Auth frontend/backend and verified DocsRAG ingestion for the orchestrator pack
- Recovered and reconciled historical unified Auth contract docs referenced by DocsRAG
- Added Auth observability and redaction safeguards for sensitive auth flows
- Audited RBAC roles across consuming services
- Completed `RBAC-REM-01` secret-source alignment review and manifest remediation for direct JWT consumers
- Completed `RBAC-REM-02` consumer JWT validation standardization
- Completed `RBAC-REM-03` Catalog frontend role-aware admin guard and stale comment cleanup
- Completed `RBAC-REM-04` SpeakASAP scoped-role normalization review
- Completed `RBAC-REM-05` School Committee local-role contract note
- Completed `RBAC-REM-06` internal service-token/API-key bypass inventory and Auth boundary review
