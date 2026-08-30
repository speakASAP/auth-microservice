# Agent Operations


## Roles
Readiness scanner classifies work; worker implements bounded scope; monitor detects conflicts; integration validator records evidence.

## Before Work
Read repository documents, establish traceability and scope, classify sensitive data, and name validation.

## Parallel Work
Do not edit shared contracts, schemas, migrations, deployment files, or status artifacts concurrently without integration ownership.

## Validation Debt
Record out-of-scope failures in docs/orchestrator/VALIDATION_DEBT.md; current-task failures remain blocking.

## Handoff
State objective, files, evidence, blockers, ownership, and follow-up work.

## Project-Specific Operations
Do not directly modify user-table data; preserve bcrypt-only password hashing and redaction.
