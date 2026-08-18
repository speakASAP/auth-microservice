import { generateKeyPairSync } from 'crypto';
import { shouldSignRs256, getSigningConfig } from './jwt-secret';

describe('signing algorithm selection (F3 step 3)', () => {
  const originalEnv = process.env;
  let privatePem: string;

  beforeAll(() => {
    privatePem = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey as string;
  });

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'a-real-secret' };
    delete process.env.JWT_SIGN_ALGORITHM;
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_KEY_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('refuses to sign HS256 now that it is retired (step 4)', () => {
    // Booting on HS256 would mint tokens no verifier still accepts — a healthy-looking
    // service issuing dead credentials. Fail at startup instead.
    expect(shouldSignRs256()).toBe(false);
    expect(() => getSigningConfig()).toThrow(/signs RS256 only/);
  });

  it('signs RS256 when the flag and key material are present', () => {
    process.env.JWT_SIGN_ALGORITHM = 'RS256';
    process.env.JWT_PRIVATE_KEY = privatePem;
    process.env.JWT_KEY_ID = 'kid-1';

    expect(shouldSignRs256()).toBe(true);
    const cfg = getSigningConfig();
    expect(cfg.algorithm).toBe('RS256');
    expect(cfg.privateKey).toBe(privatePem);
    expect(cfg.keyid).toBe('kid-1');
  });

  it('omits `secret` under RS256 so @nestjs/jwt does not sign with the HMAC string', () => {
    // jsonwebtoken throws "secretOrPrivateKey must be an asymmetric key" if both are set,
    // because @nestjs/jwt prefers `secret`. Regression guard for a real crash.
    process.env.JWT_SIGN_ALGORITHM = 'RS256';
    process.env.JWT_PRIVATE_KEY = privatePem;
    process.env.JWT_KEY_ID = 'kid-1';

    expect(getSigningConfig().secret).toBeUndefined();
  });

  it('throws rather than silently downgrading when RS256 is requested without a key', () => {
    process.env.JWT_SIGN_ALGORITHM = 'RS256';

    expect(() => shouldSignRs256()).toThrow(/JWT_PRIVATE_KEY is not set/);
  });

  it('throws when RS256 is requested without a kid', () => {
    process.env.JWT_SIGN_ALGORITHM = 'RS256';
    process.env.JWT_PRIVATE_KEY = privatePem;

    expect(() => shouldSignRs256()).toThrow(/JWT_KEY_ID is not set/);
  });
});
