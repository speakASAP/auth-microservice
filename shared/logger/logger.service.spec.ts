import { LoggerService } from './logger.service';

describe('LoggerService redaction', () => {
  it('redacts JWTs and bearer credentials', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.signature_value';

    const redacted = LoggerService.redactSensitive(
      `Authorization: Bearer ${jwt} access=${jwt}`,
    );

    expect(redacted).not.toContain(jwt);
    expect(redacted).toContain('[REDACTED_JWT]');
  });

  it('redacts token and password values in URLs and JSON-like strings', () => {
    const redacted = LoggerService.redactSensitive(
      'url=https://auth.alfares.cz/reset-password?token=secret-reset-token&return_url=https://app.alfares.cz ' +
        '{"password":"plain-text","access_token":"oauth-token","client_secret":"oauth-secret"}',
    );

    expect(redacted).not.toContain('secret-reset-token');
    expect(redacted).not.toContain('plain-text');
    expect(redacted).not.toContain('oauth-token');
    expect(redacted).not.toContain('oauth-secret');
    expect(redacted).toContain('token=[REDACTED]');
    expect(redacted).toContain('"password":"[REDACTED]"');
  });
});
