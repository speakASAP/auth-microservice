/**
 * JWKS endpoint.
 *
 * Publishes the RS256 public key so verifying services verify without holding
 * signing material. Public and unauthenticated: a public key is not a secret.
 *
 * An empty key set means keys are not provisioned — that is a misconfigured
 * issuer; callers must not fall back to any other algorithm.
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
      // Keys not provisioned — empty JWKS. Callers must fail closed (RS256 required).
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
