/**
 * Dual-algorithm JWT verification (TASK-KEY-F3).
 *
 * HS256 is symmetric: holding the secret needed to *verify* a token is the same as
 * holding the secret needed to *mint* one. Every service sharing auth's JWT_SECRET
 * could therefore forge any token, including `global:superadmin`. Under RS256 the
 * verifier holds only auth's public key and cannot sign at all.
 *
 * During the migration both are accepted, RS256 first:
 *
 *   1. auth publishes its public key at /.well-known/jwks.json  (done)
 *   2. verifiers accept RS256 *and* HS256                       (this file)
 *   3. auth switches to signing RS256
 *   4. HS256 is removed and the shared secret rotated
 *
 * The order matters. Accepting RS256 before auth issues it is a no-op; issuing it
 * before verifiers accept it invalidates every token in the ecosystem at once.
 *
 * The key set is cached because it is fetched on the request path; a miss on an
 * unknown `kid` refetches once so key rotation does not need a redeploy.
 */

import { Logger, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, KeyObject } from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWKS_TTL_MS = 5 * 60 * 1000;

interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
}

let cachedKeys = new Map<string, KeyObject>();
let cachedAt = 0;
let inFlight: Promise<void> | null = null;

function jwksUrl(): string {
  const base = process.env.AUTH_SERVICE_URL || 'http://auth-microservice:3370';
  return `${base.replace(/\/$/, '')}/.well-known/jwks.json`;
}

async function refreshJwks(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const url = jwksUrl();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        throw new Error(`JWKS fetch failed: HTTP ${res.status} from ${url}`);
      }
      const body = (await res.json()) as { keys?: Jwk[] };
      const next = new Map<string, KeyObject>();
      for (const k of body.keys ?? []) {
        if (k.kty !== 'RSA' || !k.kid) continue;
        next.set(k.kid, createPublicKey({ key: k as unknown as jwt.Secret, format: 'jwk' } as never));
      }
      cachedKeys = next;
      cachedAt = Date.now();
    } catch (err) {
      // Never swallow: a JWKS outage must be visible, not silently degrade to
      // HS256-only. Verification still falls back, but the failure is logged.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[jwt-verifier] JWKS refresh failed from ${url}: ${message}`);
      throw err;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * auth-microservice is the issuer, so it already holds the public key in its own env.
 * Resolving locally avoids an HTTP self-call on every request and removes a startup
 * ordering hazard (verifying a token before this pod can serve its own JWKS).
 * Other services have no such env and fall through to the JWKS fetch below.
 */
function localPublicKeyFor(kid: string): KeyObject | null {
  const pem = process.env.JWT_PUBLIC_KEY;
  const localKid = process.env.JWT_KEY_ID;
  if (!pem || !localKid || localKid !== kid) return null;
  try {
    return createPublicKey(pem);
  } catch (err) {
    // Malformed key material must be loud: this is the issuer's own key.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jwt-verifier] JWT_PUBLIC_KEY is set but unusable: ${message}`);
    throw err;
  }
}

async function publicKeyFor(kid: string): Promise<KeyObject | null> {
  const local = localPublicKeyFor(kid);
  if (local) return local;

  const stale = Date.now() - cachedAt > JWKS_TTL_MS;
  if (cachedKeys.size === 0 || stale) {
    await refreshJwks().catch(() => undefined);
  }
  if (!cachedKeys.has(kid) && Date.now() - cachedAt > 5000) {
    // Unknown kid with a warm cache means the key set probably rotated.
    await refreshJwks().catch(() => undefined);
  }
  return cachedKeys.get(kid) ?? null;
}

export interface VerifiedPayload {
  sub: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

const logger = new Logger('JwtVerifier');

/**
 * Reject a token, at error level, with enough context to identify the caller.
 *
 * Every rejection path used to throw a bare UnauthorizedException and log nothing.
 * When HS256 was retired (2026-08-18) that turned an ecosystem-wide credential
 * outage into silence: fifteen services held now-dead HS256 tokens, and the only
 * visible symptom was a downstream 503 naming neither auth nor the algorithm. It
 * went unnoticed for six days.
 *
 * `sub` and `alg` are safe to log and are what makes a failure actionable — they
 * name which principal presented what. The token itself is never logged: it is a
 * live bearer credential, and a rejection here does not mean it is worthless
 * elsewhere.
 */
function rejectToken(reason: string, context: { alg?: string; kid?: string; sub?: unknown }): never {
  const parts = [
    `alg=${context.alg ?? 'none'}`,
    context.kid ? `kid=${context.kid}` : null,
    `sub=${typeof context.sub === 'string' && context.sub ? context.sub : 'unknown'}`,
  ].filter(Boolean);

  logger.error(`Token rejected: ${reason} (${parts.join(' ')})`);
  throw new UnauthorizedException(reason);
}

/**
 * Verify an auth-issued token. RS256 only; HS256 was retired in F3 step 4.
 * Throws UnauthorizedException if the token is not accepted.
 */
export async function verifyAuthToken(token: string): Promise<VerifiedPayload> {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;
  const sub = (decoded?.payload as { sub?: unknown } | undefined)?.sub;

  if (alg === 'RS256') {
    const kid = decoded?.header?.kid;
    if (!kid) rejectToken('RS256 token has no kid', { alg, sub });
    const key = await publicKeyFor(kid);
    if (!key) rejectToken(`No JWKS key for kid ${kid}`, { alg, kid, sub });
    try {
      return jwt.verify(token, key, { algorithms: ['RS256'] }) as VerifiedPayload;
    } catch (err) {
      rejectToken(err instanceof Error ? err.message : 'Invalid token', { alg, kid, sub });
    }
  }

  // TASK-KEY-F3 step 4: HS256 is retired. auth signs RS256 only, so any non-RS256 token
  // is either a pre-migration leftover or a forgery attempt. Accepting HS256 here would
  // keep the shared secret forgery-capable, which is the whole point of the migration.
  rejectToken(`Unsupported token algorithm ${alg ?? 'none'}; RS256 required`, { alg, sub });
}
