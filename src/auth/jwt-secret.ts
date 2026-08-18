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

/**
 * RS256 signing material (TASK-KEY-F3).
 *
 * The HS256 secret above is symmetric: every service that *verifies* a token also
 * holds everything needed to *mint* one. Ten services shared one such value, so any
 * of them could forge a token — including `global:superadmin` — that all the others
 * would accept. Splitting the shared secret per service would shrink the blast radius
 * but keep that property; moving to RS256 removes it. Verifiers get only the public
 * key and become structurally incapable of signing.
 *
 * Returns null when the keys are absent so the migration can be staged: during the
 * transition auth still signs HS256, and verifiers accept both algorithms. Once every
 * verifier accepts RS256, signing flips over and HS256 is retired.
 */
export function getJwtPrivateKey(): string | null {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key || key.trim() === '') return null;
  if (!key.includes('BEGIN') || !key.includes('PRIVATE KEY')) {
    throw new Error(
      'JWT_PRIVATE_KEY is set but is not a PEM private key. It must be the full PEM ' +
        'block from Vault (secret/prod/auth-microservice), newlines included.',
    );
  }
  return key;
}

export function getJwtPublicKey(): string | null {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key || key.trim() === '') return null;
  if (!key.includes('BEGIN') || !key.includes('PUBLIC KEY')) {
    throw new Error(
      'JWT_PUBLIC_KEY is set but is not a PEM public key. It must be the full PEM ' +
        'block from Vault (secret/prod/auth-microservice), newlines included.',
    );
  }
  return key;
}

export function getJwtKeyId(): string | null {
  const kid = process.env.JWT_KEY_ID;
  return kid && kid.trim() !== '' ? kid : null;
}

/**
 * Whether to sign new tokens with RS256. Off until every verifier accepts RS256 —
 * flipping this before then would invalidate every token in the ecosystem at once.
 */
export function shouldSignRs256(): boolean {
  if (process.env.JWT_SIGN_ALGORITHM !== 'RS256') return false;

  // Requested RS256 but the key is missing: previously this returned false, which
  // silently downgraded to HS256 — the operator sets the flag, sees a healthy boot,
  // and believes the migration happened while auth still mints symmetric tokens.
  // Refuse to start instead.
  const key = getJwtPrivateKey();
  if (!key) {
    throw new Error(
      'JWT_SIGN_ALGORITHM=RS256 but JWT_PRIVATE_KEY is not set. auth-microservice will not ' +
        'silently fall back to HS256. Set the PEM from Vault (secret/prod/auth-microservice) ' +
        'or unset JWT_SIGN_ALGORITHM to stay on HS256.',
    );
  }

  if (!getJwtKeyId()) {
    throw new Error(
      'JWT_SIGN_ALGORITHM=RS256 but JWT_KEY_ID is not set. Tokens would be signed without a ' +
        'kid header and no verifier could select the right JWKS key.',
    );
  }

  return true;
}

/**
 * The signing configuration for JwtModule. Centralised so the algorithm decision is made
 * in exactly one place and can be logged at boot.
 */
export function getSigningConfig(): {
  algorithm: 'RS256' | 'HS256';
  secret?: string;
  privateKey?: string;
  keyid?: string;
} {
  if (shouldSignRs256()) {
    // `secret` is deliberately omitted: @nestjs/jwt prefers it over `privateKey` when both
    // are present and would hand the HMAC string to RS256 ("secretOrPrivateKey must be an
    // asymmetric key"). Verification of pre-flip HS256 tokens does not run through
    // JwtService at all — every path uses verifyAuthToken(), which reads JWT_SECRET itself.
    return {
      algorithm: 'RS256',
      privateKey: getJwtPrivateKey() as string,
      keyid: getJwtKeyId() as string,
    };
  }
  // TASK-KEY-F3 step 4: HS256 signing is retired. Reaching here means the flag is unset
  // or the key material vanished — booting on HS256 would mint tokens no verifier in the
  // ecosystem still accepts, which looks like a healthy service issuing dead credentials.
  throw new Error(
    'auth-microservice signs RS256 only (TASK-KEY-F3 step 4). Set JWT_SIGN_ALGORITHM=RS256 ' +
      'with JWT_PRIVATE_KEY and JWT_KEY_ID from Vault (secret/prod/auth-microservice).',
  );
}
