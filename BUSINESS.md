# Business: auth-microservice

status: approved
completeness_level: complete

## Problem
Ecosystem applications need one trusted identity and access boundary instead of duplicated registration and token logic.

## Target Users and Stakeholders
End users, application teams, and internal services consume the authentication authority.

## Value Proposition
Centralized JWT authentication and user management for Statex services.

## Goals
Maintain trusted login, JWT, refresh token, RBAC, OAuth, magic-link, preference, and service-authentication behavior.

## Non-Goals
Auth does not own commerce domains, notification delivery, logging storage, database infrastructure, or gateway behavior.

## Success Metrics
Consumers use the documented contract and backend health remains available on port 3370.

## Business Constraints
Use bcrypt only; never expose or log JWT secrets; agents do not directly write user-table data.

## Approval
Approved by: project owner
Approval evidence: owner-confirmation: auth-microservice-onboarding-approved
