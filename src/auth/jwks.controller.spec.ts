import 'reflect-metadata';
import { generateKeyPairSync, createPublicKey } from 'crypto';
import { JwksController } from './jwks.controller';

describe('JwksController', () => {
  const originalEnv = process.env;
  let publicPem: string;
  let privatePem: string;

  beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicPem = publicKey as string;
    privatePem = privateKey as string;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.JWT_KEY_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('serves an empty key set before the keys are provisioned', () => {
    // The migration depends on this: verifiers ship RS256 support first and must not
    // break while auth is still HS256-only.
    expect(new JwksController().getJwks()).toEqual({ keys: [] });
  });

  it('serves an empty key set when the kid is missing', () => {
    process.env.JWT_PUBLIC_KEY = publicPem;
    expect(new JwksController().getJwks()).toEqual({ keys: [] });
  });

  it('publishes the RSA public key as a JWK', () => {
    process.env.JWT_PUBLIC_KEY = publicPem;
    process.env.JWT_KEY_ID = 'test-kid-1';

    const { keys } = new JwksController().getJwks();

    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256', kid: 'test-kid-1' });
    const expected = createPublicKey(publicPem).export({ format: 'jwk' }) as { n: string; e: string };
    expect(keys[0].n).toBe(expected.n);
    expect(keys[0].e).toBe(expected.e);
  });

  it('never exposes private key material', () => {
    process.env.JWT_PUBLIC_KEY = publicPem;
    process.env.JWT_KEY_ID = 'test-kid-1';

    const { keys } = new JwksController().getJwks();
    const serialized = JSON.stringify(keys);

    expect(serialized).not.toContain('PRIVATE');
    // RSA private components must never appear in a JWKS: d is the private exponent,
    // p/q/dp/dq/qi the CRT factors.
    for (const secretField of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(Object.keys(keys[0])).not.toContain(secretField);
    }
    expect(privatePem).toContain('PRIVATE');
  });

  it('rejects a non-PEM public key rather than serving something unusable', () => {
    process.env.JWT_PUBLIC_KEY = 'not-a-pem';
    process.env.JWT_KEY_ID = 'test-kid-1';

    expect(() => new JwksController().getJwks()).toThrow(/not a PEM public key/);
  });
});
