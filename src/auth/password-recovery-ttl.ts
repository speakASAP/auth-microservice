/**
 * The single source of truth for every password-recovery lifetime: the recovery code, the
 * grant it buys, and the grant issued by the email-link path. Kept as its own module so the
 * "one variable" rule is enforced by imports rather than by convention.
 */

export const PASSWORD_RECOVERY_TTL_ENV = 'AUTH_PASSWORD_RECOVERY_TTL_MINUTES';
export const PASSWORD_RECOVERY_TTL_DEFAULT_MINUTES = 15;

export function resolvePasswordRecoveryTtlMinutes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env[PASSWORD_RECOVERY_TTL_ENV]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return PASSWORD_RECOVERY_TTL_DEFAULT_MINUTES;
  }
  return parsed;
}
