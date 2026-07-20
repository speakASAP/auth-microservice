import { UnsubscribeTokenService } from './unsubscribe-token.service';

describe('UnsubscribeTokenService', () => {
  const secret = 'test-secret-value';
  let service: UnsubscribeTokenService;

  beforeEach(() => {
    process.env.MARKETING_UNSUBSCRIBE_SECRET = secret;
    service = new UnsubscribeTokenService();
  });

  it('round-trips a token', () => {
    const token = service.mint('user-1', 'marathon');
    expect(service.verify(token)).toEqual({ userId: 'user-1', product: 'marathon' });
  });

  it('rejects a tampered payload', () => {
    const token = service.mint('user-1', 'marathon');
    const [payload, sig] = token.split('.');
    const forged = Buffer.from('user-2|marathon|9999999999').toString('base64url');
    expect(service.verify(`${forged}.${sig}`)).toBeNull();
    expect(payload).not.toBe(forged);
  });

  it('rejects a malformed token', () => {
    expect(service.verify('garbage')).toBeNull();
    expect(service.verify('')).toBeNull();
  });

  it('rejects an expired token', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
    const token = service.mint('user-1', 'speakasap');
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000 + 400 * 24 * 3600 * 1000);
    expect(service.verify(token)).toBeNull();
    jest.restoreAllMocks();
  });

  it('rejects an unknown product', () => {
    const payload = Buffer.from('user-1|bazos|9999999999').toString('base64url');
    expect(service.verify(`${payload}.whatever`)).toBeNull();
  });
});
