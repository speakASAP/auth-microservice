/**
 * JWT signing material for auth-microservice (RS256 only).
 *
 * Auth is the ecosystem's only JWT issuer. Tokens are signed with JWT_PRIVATE_KEY
 * (RS256). Verifiers use JWT_PUBLIC_KEY / JWKS and cannot mint tokens.
 *
 * JWT_SECRET remains Auth-owned material for non-JWT HMAC uses (e.g. contact-code
 * digests). It is not a signing algorithm for access or service tokens.
 */

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim() === '') {
    throw new Error(
      'JWT_SECRET is not set. auth-microservice requires it for Auth-owned HMAC ' +
        'helpers (contact codes). Set it from Vault (secret/prod/auth-microservice).',
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
 * Whether to sign new tokens with RS256. Required in production.
 */
export function shouldSignRs256(): boolean {
  if (process.env.JWT_SIGN_ALGORITHM !== 'RS256') return false;

  const key = getJwtPrivateKey();
  if (!key) {
    throw new Error(
      'JWT_SIGN_ALGORITHM=RS256 but JWT_PRIVATE_KEY is not set. Set the PEM from ' +
        'Vault (secret/prod/auth-microservice).',
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
 * The signing configuration for JwtModule. RS256 only.
 */
export function getSigningConfig(): {
  algorithm: 'RS256';
  privateKey: string;
  keyid: string;
} {
  if (shouldSignRs256()) {
    return {
      algorithm: 'RS256',
      privateKey: getJwtPrivateKey() as string,
      keyid: getJwtKeyId() as string,
    };
  }
  throw new Error(
    'auth-microservice signs RS256 only. Set JWT_SIGN_ALGORITHM=RS256 ' +
      'with JWT_PRIVATE_KEY and JWT_KEY_ID from Vault (secret/prod/auth-microservice).',
  );
}
