import 'reflect-metadata';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync, createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { verifyAuthToken } from './jwt-verifier';

describe('verifyAuthToken (F3 step 4: RS256-only)', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const KID = 'test-kid-1';
  let privatePem: string;
  let publicPem: string;

  beforeAll(() => {
    const kp = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privatePem = kp.privateKey as string;
    publicPem = kp.publicKey as string;
  });

  beforeEach(() => {
    jest.resetModules();
    // Clear auth's own key env so these tests exercise the JWKS path. The local
    // short-circuit is covered separately below.
    process.env = { ...originalEnv, JWT_SECRET: 'hs256-shared-secret' };
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.JWT_KEY_ID;
    const jwk = createPublicKey(publicPem).export({ format: 'jwk' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('accepts an RS256 token signed by auth', async () => {
    const token = jwt.sign({ sub: 'u1', roles: ['user'] }, privatePem, {
      algorithm: 'RS256',
      keyid: KID,
    });

    await expect(verifyAuthToken(token)).resolves.toMatchObject({ sub: 'u1', roles: ['user'] });
  });

  it('rejects an HS256 token now that HS256 is retired (step 4)', async () => {
    const token = jwt.sign({ sub: 'u2', roles: ['admin'] }, 'hs256-shared-secret', {
      algorithm: 'HS256',
    });

    await expect(verifyAuthToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // The attack this migration must not introduce: an attacker takes the PUBLIC key
  // (published at /.well-known/jwks.json) and uses it as an HMAC secret, signing
  // HS256. A verifier that does not pin algorithms would accept it as authentic.
  // A rejected token must leave a trace. Before this, every rejection path threw a
  // bare UnauthorizedException and logged nothing, so an ecosystem-wide credential
  // outage (HS256 retirement, 2026-08-18) ran silently for six days: the only symptom
  // was a downstream 503 that named neither auth nor the algorithm.
  describe('rejection logging', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('logs the rejected algorithm when a non-RS256 token is refused', async () => {
      const token = jwt.sign({ sub: 'svc-catalog', roles: ['internal:x:admin'] }, 'hs256-shared-secret', {
        algorithm: 'HS256',
      });

      await expect(verifyAuthToken(token)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(errorSpy).toHaveBeenCalled();
      const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).toContain('HS256');
      expect(logged).toContain('svc-catalog');
    });

    it('logs when an RS256 token has no matching JWKS key', async () => {
      const token = jwt.sign({ sub: 'svc-orders' }, privatePem, {
        algorithm: 'RS256',
        keyid: 'kid-that-does-not-exist',
      });

      await expect(verifyAuthToken(token)).rejects.toBeInstanceOf(UnauthorizedException);

      const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).toContain('kid-that-does-not-exist');
    });

    it('never logs the token itself', async () => {
      const token = jwt.sign({ sub: 'svc-secret' }, 'hs256-shared-secret', { algorithm: 'HS256' });

      await expect(verifyAuthToken(token)).rejects.toBeInstanceOf(UnauthorizedException);

      const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(token.split('.')[2]);
    });
  });

  it('rejects an algorithm-confusion token signed HS256 with the public key', async () => {
    // Two defences must both hold. The routing check (header alg drives which path
    // runs) means this token is handed to the HS256 branch, where it must fail
    // because the HMAC secret is JWT_SECRET and not the public key.
    const forged = jwt.sign({ sub: 'attacker', roles: ['global:superadmin'] }, publicPem, {
      algorithm: 'HS256',
    });

    await expect(verifyAuthToken(forged)).rejects.toThrow(UnauthorizedException);
  });

  // The `algorithms: ['HS256']` pin on the HS256 branch is a second, independent
  // defence: it stops a token from being verified under an algorithm the branch did
  // not intend. Asserted directly against jsonwebtoken, because verifyAuthToken's own
  // header routing would mask its absence — a test that passes with the pin removed
  // proves nothing about the pin.
  it('rejects a token claiming another alg and HMAC-signed with JWT_SECRET', async () => {
    // The real confusion attack: the header claims an algorithm the verifier does not
    // expect, but the signature is a plain HMAC over JWT_SECRET. Without
    // `algorithms: ['HS256']`, jsonwebtoken honours the attacker-supplied header and
    // verifies it. Forged by hand because jwt.sign() will not emit a mismatched header.
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const header = b64({ alg: 'HS384', typ: 'JWT' });
    const body = b64({ sub: 'attacker', roles: ['global:superadmin'] });
    const sig = require('crypto')
      .createHmac('sha384', process.env.JWT_SECRET as string)
      .update(`${header}.${body}`)
      .digest('base64url');
    const forged = `${header}.${body}.${sig}`;

    await expect(verifyAuthToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unsigned alg:none token', async () => {
    const forged = jwt.sign({ sub: 'attacker', roles: ['global:superadmin'] }, '', {
      algorithm: 'none',
    });

    await expect(verifyAuthToken(forged)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an RS256 token signed by a different key', async () => {
    const rogue = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const forged = jwt.sign({ sub: 'attacker', roles: ['global:superadmin'] }, rogue.privateKey as string, {
      algorithm: 'RS256',
      keyid: KID,
    });

    await expect(verifyAuthToken(forged)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an RS256 token whose kid is not in the key set', async () => {
    const token = jwt.sign({ sub: 'u3' }, privatePem, { algorithm: 'RS256', keyid: 'unknown-kid' });

    await expect(verifyAuthToken(token)).rejects.toThrow(/No JWKS key for kid/);
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign({ sub: 'u4' }, privatePem, {
      algorithm: 'RS256',
      keyid: KID,
      expiresIn: '-1s',
    });

    await expect(verifyAuthToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('resolves auth\'s own public key from env without fetching JWKS', async () => {
    process.env.JWT_PUBLIC_KEY = publicPem;
    process.env.JWT_KEY_ID = KID;
    const fetchSpy = global.fetch as jest.Mock;
    fetchSpy.mockClear();

    const token = jwt.sign({ sub: 'u-local', roles: ['user'] }, privatePem, {
      algorithm: 'RS256',
      keyid: KID,
    });

    await expect(verifyAuthToken(token)).resolves.toMatchObject({ sub: 'u-local' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
