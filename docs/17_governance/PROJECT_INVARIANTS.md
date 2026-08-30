# Project Invariants: auth-microservice

status: reviewed
completeness_level: complete

## Purpose
State boundaries every Auth change preserves.

## Applicability
Applies to documentation, code, contracts, and operations.

## Invariants
Identity remains centralized; bcrypt remains required; secrets and private data are not committed or logged; commerce and notification delivery remain outside Auth.

## Exceptions
Only a project-owner-approved documented decision may alter an invariant.

## Review Cadence
Review before each plan and after contract-affecting changes.
