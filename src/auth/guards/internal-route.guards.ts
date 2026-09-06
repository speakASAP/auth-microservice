import { Injectable } from '@nestjs/common';
import { InternalServiceOrRoleGuard } from './internal-service-or-role.guard';

/**
 * Per-route gates for auth's own `/auth/internal/*` and `/internal/*` routes.
 *
 * These replace bare `InternalServiceGuard` on those routes. That guard accepted
 * a static shared `INTERNAL_SERVICE_TOKEN` plus a self-asserted `x-service-name`
 * header — a credential with no identity, not revocable per caller, and where
 * the caller chose which service it claimed to be. Both are prohibited by
 * `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`.
 *
 * Each guard below names the smallest role that lets its route succeed, so a
 * credential minted for one route cannot drive another. That separation is the
 * point: before this, any holder of the shared secret could call
 * `magic-link/token` — which mints a usable user session — with a credential
 * provisioned to check whether an email exists.
 *
 * Roles are classified by effect, not HTTP verb, per the standard. They are
 * created by `scripts/seed-internal-route-roles.js` and must exist before
 * `provision-service-token.js` can mint against them.
 *
 * The inherited static-token path stays open for now so existing callers keep
 * working while their per-pair credentials are provisioned; it is closed by
 * setting `ALLOW_INTERNAL_STATIC_TOKEN=false` once every caller presents a
 * bearer. RS256 is tried first regardless, so a caller holding a real principal
 * is always identified as that principal rather than as an anonymous holder of
 * the shared secret.
 */

/** `GET /auth/internal/check-email` — existence probe keyed by email. */
@Injectable()
export class InternalEmailCheckGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:email-check'];
  }
}

/** `GET /internal/users/:userId/existence` — existence probe keyed by user id. */
@Injectable()
export class InternalUserExistenceGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:user-existence'];
  }
}

/**
 * Registered-user communication preferences and unsubscribe state.
 *
 * One role covers the read and the write. Splitting them would mean minting two
 * credentials for one caller (marketing reads preferences precisely so it can
 * update them), which adds rotation surface without reducing authority.
 */
@Injectable()
export class InternalPreferencesGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:preferences'];
  }
}

/**
 * `POST /auth/internal/magic-link/token`.
 *
 * Its own role, never shared with the read routes: this endpoint mints a
 * magic-link verify URL, so a credential holding it can create a logged-in
 * session for any user. It is the highest-authority route in this group.
 */
@Injectable()
export class InternalMagicLinkGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:magic-link'];
  }
}
