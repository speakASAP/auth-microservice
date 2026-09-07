import { Injectable } from '@nestjs/common';
import { InternalServiceOrRoleGuard } from './internal-service-or-role.guard';

/**
 * Per-route gates for auth's own `/auth/internal/*` and `/internal/*` routes.
 *
 * Each guard accepts only a per-pair RS256 Bearer principal per
 * `docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`. Static shared tokens and
 * self-asserted `x-service-name` headers are not accepted.
 *
 * Each guard names the smallest role that lets its route succeed, so a
 * credential minted for one route cannot drive another. That separation is the
 * point: a credential provisioned to check whether an email exists must not be
 * able to call `magic-link/token` — which mints a usable user session.
 *
 * Roles are classified by effect, not HTTP verb, per the standard. They are
 * created by `scripts/seed-internal-route-roles.js` and must exist before
 * `provision-service-token.js` can mint against them.
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

/**
 * SpeakASAP legacy id ↔ auth UUID lookups (read only).
 *
 * Covers `by-legacy-id`, `by-auth-user`, and `names-by-legacy-ids`. Never
 * shared with provision or session mint: education-service needs the reverse
 * map for drill identity, not the ability to create users or sessions.
 */
@Injectable()
export class InternalLegacyLookupGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:legacy-lookup'];
  }
}

/**
 * SpeakASAP portal SSO handoff: resolve-or-provision + session mint.
 *
 * One role for both steps of one flow (same pattern as preferences). A
 * credential holding it can create Auth users and mint browser sessions —
 * keep it on speakasap-frontend only.
 */
@Injectable()
export class InternalSsoHandoffGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:sso-handoff'];
  }
}

/**
 * `POST /internal/roles/speakasap/teacher/:userId` — fixed teacher grant only.
 *
 * Own role so a legacy-lookup or SSO credential cannot grant app roles.
 */
@Injectable()
export class InternalSpeakasapTeacherGrantGuard extends InternalServiceOrRoleGuard {
  protected requiredRoles(): string[] {
    return ['internal:auth-microservice:speakasap-teacher-grant'];
  }
}
