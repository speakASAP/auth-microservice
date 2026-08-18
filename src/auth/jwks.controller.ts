/**
 * JWKS endpoint (TASK-KEY-F3).
 *
 * Publishes the RS256 *public* key so verifying services no longer need any shared
 * signing material. This endpoint is deliberately public and unauthenticated: a public
 * key is not a secret, and requiring a credential to fetch it would reintroduce the
 * bootstrap problem the migration exists to remove.
 *
 * Serving an empty key set (rather than erroring) while the keys are unset is what lets
 * verifiers deploy their RS256 support before signing flips over.
 *
 * This service has no global auth guard: routes are open unless they declare @UseGuards,
 * so this controller needs no decorator to stay reachable.
 */

import { Controller, Get, Header } from '@nestjs/common';
import { createPublicKey } from 'crypto';
import { getJwtPublicKey, getJwtKeyId } from './jwt-secret';

interface Jwk {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

@Controller('.well-known')
export class JwksController {
  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  getJwks(): { keys: Jwk[] } {
    const pem = getJwtPublicKey();
    const kid = getJwtKeyId();

    if (!pem || !kid) {
      // Keys not provisioned yet. An empty set is the correct answer during the
      // migration — it is not an error, and callers fall back to HS256.
      return { keys: [] };
    }

    const jwk = createPublicKey(pem).export({ format: 'jwk' }) as { n?: string; e?: string };
    if (!jwk.n || !jwk.e) {
      throw new Error('JWT_PUBLIC_KEY did not export as an RSA JWK — check the PEM in Vault.');
    }

    return {
      keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid, n: jwk.n, e: jwk.e }],
    };
  }
}
