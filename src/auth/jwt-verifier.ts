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

import { UnauthorizedException } from '@nestjs/common';
import { createPublicKey, KeyObject } from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWKS_TTL_MS = 5 * 60 * 1000;
const UNKNOWN_KID_REFRESH_COOLDOWN_MS = 5000;
const UNKNOWN_KID_REFRESH_RETENTION_MS = 60 * 1000;

interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
}

let cachedKeys = new Map<string, KeyObject>();
let cachedAt = 0;
let inFlight: Promise<void> | null = null;
let lastUnknownKidRefreshAt = new Map<string, number>();

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
  if (!cachedKeys.has(kid) && shouldRefreshForUnknownKid(kid)) {
    // Unknown kid with a warm cache can mean the key set just rotated. Try once
    // immediately for this kid, then throttle repeated misses for forged tokens.
    await refreshJwks().catch(() => undefined);
  }
  return cachedKeys.get(kid) ?? null;
}

function shouldRefreshForUnknownKid(kid: string): boolean {
  const now = Date.now();
  for (const [knownKid, refreshedAt] of lastUnknownKidRefreshAt) {
    if (now - refreshedAt > UNKNOWN_KID_REFRESH_RETENTION_MS) {
      lastUnknownKidRefreshAt.delete(knownKid);
    }
  }

  const lastRefresh = lastUnknownKidRefreshAt.get(kid);
  if (lastRefresh && now - lastRefresh <= UNKNOWN_KID_REFRESH_COOLDOWN_MS) {
    return false;
  }

  lastUnknownKidRefreshAt.set(kid, now);
  return true;
}

export interface VerifiedPayload {
  sub: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

/**
 * Verify an auth-issued token, preferring RS256 and falling back to HS256 while the
 * migration is in progress. Throws UnauthorizedException if neither path accepts it.
 */
export async function verifyAuthToken(token: string): Promise<VerifiedPayload> {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;

  if (alg === 'RS256') {
    const kid = decoded?.header?.kid;
    if (!kid) throw new UnauthorizedException('RS256 token has no kid');
    const key = await publicKeyFor(kid);
    if (!key) throw new UnauthorizedException(`No JWKS key for kid ${kid}`);
    try {
      return jwt.verify(token, key, { algorithms: ['RS256'] }) as VerifiedPayload;
    } catch (err) {
      throw new UnauthorizedException(err instanceof Error ? err.message : 'Invalid token');
    }
  }

  // TASK-KEY-F3 step 4: HS256 is retired. auth signs RS256 only, so any non-RS256 token
  // is either a pre-migration leftover or a forgery attempt. Accepting HS256 here would
  // keep the shared secret forgery-capable, which is the whole point of the migration.
  throw new UnauthorizedException(`Unsupported token algorithm ${alg ?? 'none'}; RS256 required`);
}
