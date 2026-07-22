import { AuthService } from './auth.service';
import { AuthEventPublisher } from '../events/auth-event-publisher.service';

/**
 * Which auth flows emit `auth.user.registered.v1`, and which deliberately do not (C-005 §2.2b).
 *
 * These paths had no test coverage at all before W3, so the existing suite could not have caught
 * a mistake here: `register()` is reached only in production, by every application in the
 * ecosystem. Two things are being pinned:
 *
 *   1. the owner's decision that a registration means *proven identity*, not a row appearing, and
 *   2. that a publisher failure cannot break signing up.
 */

const user = (over: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'someone@example.com',
  phone: '+420777123456',
  userType: 'end_user',
  ...over,
});

function buildService(overrides: { findByEmail?: unknown } = {}) {
  const events = { publishUserRegistered: jest.fn(async () => undefined) };

  const usersService = {
    findByEmail: jest.fn(async () => (overrides.findByEmail === undefined ? null : overrides.findByEmail)),
    findById: jest.fn(async () => user()),
    create: jest.fn(async () => user()),
    update: jest.fn(async () => user()),
  };
  const rolesService = {
    assignDefaultApplicationAccess: jest.fn(async () => undefined),
    getUserRoles: jest.fn(async () => []),
  };
  const jwtService = { sign: jest.fn(() => 'a.jwt.token') };
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const marketingConsent = { grant: jest.fn(async () => ({ id: 'consent-1' })) };
  const repo = () => ({ findOne: jest.fn(), save: jest.fn(), create: jest.fn() });

  const service = new AuthService(
    usersService as never,
    rolesService as never,
    jwtService as never,
    logger as never,
    { axiosRef: { post: jest.fn() } } as never,
    repo() as never,
    repo() as never,
    repo() as never,
    repo() as never,
    events as unknown as AuthEventPublisher,
    marketingConsent as never,
  );

  return { service, events, usersService, marketingConsent };
}

describe('registration events (EP-005 W3)', () => {
  describe('password registration — proven identity', () => {
    it('emits once for a new user', async () => {
      const { service, events } = buildService();

      await service.register({
        email: 'someone@example.com',
        password: 'correct horse battery staple',
      } as never);

      expect(events.publishUserRegistered).toHaveBeenCalledTimes(1);
      expect(events.publishUserRegistered).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', registrationMethod: 'password' }),
      );
    });

    it('carries the state parameter through as the correlationId', async () => {
      // This is the whole point of the join: bazos mints a correlationId, it crosses to auth in
      // `state`, and it comes back out here. Drop it and every registration is unattributable.
      const { service, events } = buildService();

      await service.register({
        email: 'someone@example.com',
        password: 'correct horse battery staple',
        state: 'corr-from-landing',
        client_id: 'bazos-service',
      } as never);

      expect(events.publishUserRegistered).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'corr-from-landing',
          applicationContext: 'bazos-service',
        }),
      );
    });

    it('emits nothing when the email is already taken', async () => {
      const { service, events } = buildService({ findByEmail: user() });

      await expect(
        service.register({ email: 'someone@example.com', password: 'x' } as never),
      ).rejects.toThrow();

      expect(events.publishUserRegistered).not.toHaveBeenCalled();
    });
  });

  describe('the publisher must never be able to break registration', () => {
    it('still registers the user when publishing rejects', async () => {
      // The real publisher swallows its own failures; this asserts the call site does not
      // reintroduce the dependency by letting a rejection escape. A broker outage must not stop
      // every application in the ecosystem from signing people up.
      const { service, events } = buildService();
      events.publishUserRegistered.mockRejectedValueOnce(new Error('broker down'));

      await expect(
        service.register({
          email: 'someone@example.com',
          password: 'correct horse battery staple',
        } as never),
      ).resolves.toMatchObject({ user: expect.objectContaining({ id: 'user-1' }) });
    });
  });

  describe('contact provisioning is not a registration', () => {
    it('emits nothing for register-contact', async () => {
      // registerContact returns authenticated:false, isVerified:false — a contact-capture form,
      // not someone who has proved anything. Counting it would inflate conversions.
      const { service, events } = buildService();

      await service
        .registerContact({
          name: 'Someone',
          contacts: [{ type: 'email', value: 'someone@example.com', isPrimary: true }],
        } as never)
        .catch(() => undefined);

      expect(events.publishUserRegistered).not.toHaveBeenCalled();
    });
  });
});

describe('marketing consent at registration', () => {
  it('records evidence only when the person actually ticked the box', async () => {
    const { service, marketingConsent } = buildService();

    await service.register(
      { email: 'someone@example.com', password: 'correct horse battery staple', marketing_consent: true } as never,
      { ip: '198.51.100.7', userAgent: 'Mozilla/5.0' },
    );

    expect(marketingConsent.grant).toHaveBeenCalledWith(
      'user-1',
      'bazos',
      expect.stringContaining('bazos-marketing'),
      '198.51.100.7',
      'Mozilla/5.0',
    );
  });

  it.each([
    ['absent', undefined],
    ['false', false],
    ['a truthy string, which is not a tick', 'yes'],
    ['1, which is not a tick either', 1],
  ])('records nothing when consent is %s', async (_label, value) => {
    // Anything short of an explicit true is a refusal. Consent has to be an active choice, so a
    // value that merely looks affirmative must not be read as one.
    const { service, marketingConsent } = buildService();

    await service.register({
      email: 'someone@example.com',
      password: 'correct horse battery staple',
      marketing_consent: value,
    } as never);

    expect(marketingConsent.grant).not.toHaveBeenCalled();
  });

  it('registers the person even if the consent record cannot be written', async () => {
    // Refusing someone an account because a mailing-list row failed would be absurd. The consent
    // is lost rather than assumed, which means we do not email them — the safe direction.
    const { service, marketingConsent } = buildService();
    marketingConsent.grant.mockRejectedValueOnce(new Error('database down'));

    await expect(
      service.register({
        email: 'someone@example.com',
        password: 'correct horse battery staple',
        marketing_consent: true,
      } as never),
    ).resolves.toMatchObject({ user: expect.objectContaining({ id: 'user-1' }) });
  });

  it('stores the version of the text that was agreed to', async () => {
    // The wording will change. Without a version the evidence says someone consented to whatever
    // the page happens to say today, which is not evidence of anything.
    const { service, marketingConsent } = buildService();

    await service.register(
      { email: 'someone@example.com', password: 'x'.repeat(12), marketing_consent: true } as never,
    );

    const version = marketingConsent.grant.mock.calls[0][2];
    expect(version).toMatch(/^bazos-marketing-\d{4}-\d{2}-\d{2}$/);
  });
});
