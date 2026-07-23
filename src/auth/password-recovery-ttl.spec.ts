import { resolvePasswordRecoveryTtlMinutes } from './password-recovery-ttl';

describe('resolvePasswordRecoveryTtlMinutes', () => {
  it('defaults to 15 minutes when unset', () => {
    expect(resolvePasswordRecoveryTtlMinutes({})).toBe(15);
  });

  it('reads the configured value', () => {
    expect(resolvePasswordRecoveryTtlMinutes({ AUTH_PASSWORD_RECOVERY_TTL_MINUTES: '7' })).toBe(7);
  });

  // A malformed value must not silently become NaN: every downstream expiry is computed from
  // this number, and NaN milliseconds produces an Invalid Date that Postgres rejects at insert,
  // taking the whole recovery flow down rather than degrading.
  it.each(['', 'abc', '0', '-5'])('falls back to 15 for the unusable value %p', (value) => {
    expect(resolvePasswordRecoveryTtlMinutes({ AUTH_PASSWORD_RECOVERY_TTL_MINUTES: value })).toBe(15);
  });
});
