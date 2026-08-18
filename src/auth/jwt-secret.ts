/**
 * Single source of truth for the JWT signing secret.
 *
 * auth-microservice is the ecosystem's only JWT issuer, so this value signs
 * every token every other service trusts. The previous `|| 'default-secret'`
 * fallbacks meant a missing env var would not fail — the service would boot
 * and mint production tokens signed with a publicly known string, and the
 * verification path would happily accept them. That is a silent failure with
 * total auth bypass as its blast radius.
 *
 * Fail at startup instead: this is evaluated at module load, so a misconfigured
 * deploy crashes immediately rather than serving forgeable tokens.
 */
export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim() === '') {
    throw new Error(
      'JWT_SECRET is not set. auth-microservice signs every JWT in the ecosystem ' +
        'and refuses to start without it. Set it from Vault (secret/prod/auth-microservice).',
    );
  }

  if (secret === 'default-secret') {
    throw new Error(
      'JWT_SECRET is set to the placeholder "default-secret", which is public. ' +
        'Set a real value from Vault (secret/prod/auth-microservice).',
    );
  }

  return secret;
}
