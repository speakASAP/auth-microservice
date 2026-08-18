import { of, throwError } from 'rxjs';
import { LoggerService } from './logger.service';

/**
 * Ingest authentication + failure visibility.
 *
 * On 2026-07-06 logging-microservice began requiring an ingest credential. This
 * shared logger never sent one and swallowed the resulting 401 outside
 * development, so nine services stopped shipping logs and nothing surfaced it
 * for six weeks.
 */
describe('shared LoggerService ingest auth', () => {
  const originalEnv = { ...process.env };
  let httpService: { post: jest.Mock };
  let errorSpy: jest.SpyInstance;

  const build = () => new LoggerService(httpService as any);

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    httpService = { post: jest.fn().mockReturnValue(of({ status: 201, data: {} })) };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('sends the ingest credential as a Bearer token', () => {
    process.env.LOGGING_SERVICE_TOKEN = 'ingest-token';

    build().log('hello');

    expect(httpService.post).toHaveBeenCalled();
    const [, , config] = httpService.post.mock.calls[0];
    expect(config.headers.Authorization).toBe('Bearer ingest-token');
  });

  it('omits the header when no token is configured rather than sending "Bearer undefined"', () => {
    delete process.env.LOGGING_SERVICE_TOKEN;

    build().log('hello');

    const [, , config] = httpService.post.mock.calls[0];
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('reports a rejected ingest in production instead of failing silently', async () => {
    process.env.LOGGING_SERVICE_TOKEN = 'bad-token';
    httpService.post.mockReturnValue(
      throwError(() => ({ message: 'Request failed', response: { status: 401 } })),
    );

    build().log('hello');
    await new Promise((r) => setImmediate(r));

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).toMatch(/401|logging/i);
  });

  it('never logs the ingest credential value', async () => {
    process.env.LOGGING_SERVICE_TOKEN = 'super-secret-token';
    httpService.post.mockReturnValue(
      throwError(() => ({ message: 'Request failed', response: { status: 401 } })),
    );

    build().log('hello');
    await new Promise((r) => setImmediate(r));

    const logged = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).not.toContain('super-secret-token');
  });
});
