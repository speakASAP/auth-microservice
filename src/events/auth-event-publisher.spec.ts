import { AuthEventPublisher, AUTH_EVENTS_EXCHANGE, AmqpConnect } from './auth-event-publisher.service';
import { LoggerService } from '../../shared/logger/logger.service';

/**
 * `auth-microservice` is shared infrastructure: every application in the ecosystem logs in
 * through it. Two properties therefore matter more than anything this publisher does well:
 *
 *   1. a broker problem must never break registration, and
 *   2. the event must stay generic — no growth concept may enter it (EP-005 W3, C-005 §7).
 */

const loggerStub = () =>
  ({ log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }) as unknown as LoggerService & {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
  };

interface Published {
  exchange: string;
  routingKey: string;
  content: Buffer;
  options: Record<string, unknown>;
}

function fakeBroker(behaviour: { connectFails?: Error; confirmFails?: Error } = {}) {
  const published: Published[] = [];
  const exchanges: Array<{ name: string; type: string; options: unknown }> = [];

  const channel = {
    assertExchange: jest.fn(async (name: string, type: string, options: unknown) => {
      exchanges.push({ name, type, options });
    }),
    publish: jest.fn(
      (exchange: string, routingKey: string, content: Buffer, options: Record<string, unknown>) => {
        published.push({ exchange, routingKey, content, options });
        return true;
      },
    ),
    waitForConfirms: jest.fn(async () => {
      if (behaviour.confirmFails) throw behaviour.confirmFails;
    }),
    close: jest.fn(async () => undefined),
    on: jest.fn(),
  };

  const connection = {
    createConfirmChannel: jest.fn(async () => channel),
    close: jest.fn(async () => undefined),
    on: jest.fn(),
  };

  const connect: AmqpConnect = jest.fn(async () => {
    if (behaviour.connectFails) throw behaviour.connectFails;
    return connection as never;
  });

  return { connect, channel, connection, published, exchanges };
}

const registration = () => ({
  userId: 'c0ffee00-0000-4000-8000-000000000001',
  email: 'someone@example.com',
  registrationMethod: 'password' as const,
  correlationId: 'corr-from-state',
  applicationContext: 'bazos-service',
});

const sent = (broker: ReturnType<typeof fakeBroker>) =>
  JSON.parse(broker.published[0].content.toString());

describe('AuthEventPublisher', () => {
  // Without this the publisher bails out on the missing URL before it ever reaches the broker,
  // and the "does not throw" specs below would pass for the wrong reason — green while proving
  // nothing about broker failures at all.
  const previousUrl = process.env.RABBITMQ_URL;
  beforeEach(() => {
    process.env.RABBITMQ_URL = 'amqp://guest:guest@rabbitmq:5672';
  });
  afterEach(() => {
    if (previousUrl === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previousUrl;
  });

  it('does not throw, and says so, when no broker URL is configured', async () => {
    delete process.env.RABBITMQ_URL;
    const broker = fakeBroker();
    const logger = loggerStub();
    const publisher = new AuthEventPublisher(logger, broker.connect);

    await expect(publisher.publishUserRegistered(registration())).resolves.toBeUndefined();
    expect(broker.published).toHaveLength(0);
    expect(logger.error.mock.calls[0].join(' ')).toContain('RABBITMQ_URL');
  });

  describe('registration must not depend on the broker', () => {
    it('does not throw when the broker is unreachable', async () => {
      // If this rejected into the registration path, a RabbitMQ outage would stop every
      // application in the ecosystem from signing anyone up. Analytics must never be able to
      // do that.
      const broker = fakeBroker({ connectFails: new Error('ECONNREFUSED') });
      const logger = loggerStub();
      const publisher = new AuthEventPublisher(logger, broker.connect);

      await expect(publisher.publishUserRegistered(registration())).resolves.toBeUndefined();
    });

    it('does not throw when the broker refuses to confirm', async () => {
      const broker = fakeBroker({ confirmFails: new Error('nack') });
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await expect(publisher.publishUserRegistered(registration())).resolves.toBeUndefined();
    });

    it('logs the whole envelope when publishing fails, so the event can be recovered by hand', async () => {
      // There is no outbox in auth-microservice: a failed publish is a lost conversion unless
      // the payload survives somewhere. The log is that somewhere, and it has to be complete
      // enough to replay from.
      const broker = fakeBroker({ connectFails: new Error('ECONNREFUSED') });
      const logger = loggerStub();
      const publisher = new AuthEventPublisher(logger, broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(logger.error).toHaveBeenCalled();
      const logged = logger.error.mock.calls[0].join(' ');
      expect(logged).toContain('auth.user.registered.v1');
      expect(logged).toContain('c0ffee00-0000-4000-8000-000000000001');
    });
  });

  describe('envelope', () => {
    it('publishes to auth.events with the event type as the routing key', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(broker.published[0].exchange).toBe(AUTH_EVENTS_EXCHANGE);
      expect(broker.published[0].routingKey).toBe('auth.user.registered.v1');
      expect(broker.exchanges).toEqual([
        { name: AUTH_EVENTS_EXCHANGE, type: 'topic', options: { durable: true } },
      ]);
    });

    it('builds the envelope the contract describes', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(sent(broker)).toMatchObject({
        eventType: 'auth.user.registered.v1',
        eventVersion: 1,
        producer: 'auth-microservice',
        dataClass: 'personal',
      });
      expect(sent(broker).occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('waits for the broker to confirm before reporting success', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(broker.channel.waitForConfirms).toHaveBeenCalled();
      expect(broker.published[0].options).toMatchObject({
        persistent: true,
        contentType: 'application/json',
      });
    });
  });

  describe('idempotency', () => {
    it('derives the same eventId every time for the same user', async () => {
      // verifyMagicLink runs on every magic-link login, not only the first. A random eventId
      // would turn each subsequent login into a fresh "registration". A deterministic one
      // collides with the buffer's primary key in growth-core and is discarded as the duplicate
      // it is. A person registers once, so their registration has one id.
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());
      await publisher.publishUserRegistered({ ...registration(), correlationId: 'a-later-login' });

      expect(sent(broker).eventId).toBe(JSON.parse(broker.published[1].content.toString()).eventId);
    });

    it('gives different users different eventIds', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());
      await publisher.publishUserRegistered({ ...registration(), userId: 'a-different-user' });

      expect(sent(broker).eventId).not.toBe(
        JSON.parse(broker.published[1].content.toString()).eventId,
      );
    });

    it('produces a syntactically valid uuid', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(sent(broker).eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('payload', () => {
    it('carries the correlationId through from the state parameter', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(sent(broker).payload.correlationId).toBe('corr-from-state');
    });

    it('omits optional fields rather than sending nulls', async () => {
      // The schema forbids unknown properties and types these as strings; an explicit null would
      // fail validation at the consumer, which is a silent dropped conversion.
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered({
        userId: 'c0ffee00-0000-4000-8000-000000000002',
        registrationMethod: 'oauth',
      });

      const payload = sent(broker).payload;
      expect(payload).not.toHaveProperty('correlationId');
      expect(payload).not.toHaveProperty('email');
      expect(payload).not.toHaveProperty('phone');
      expect(payload).not.toHaveProperty('applicationContext');
      expect(payload.userId).toBe('c0ffee00-0000-4000-8000-000000000002');
      expect(payload.registrationMethod).toBe('oauth');
    });

    it('always states which proven-identity path produced the registration', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered({ ...registration(), registrationMethod: 'magic_link' });

      expect(sent(broker).payload.registrationMethod).toBe('magic_link');
      expect(sent(broker).payload.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('EP-005 W3 — the event stays generic', () => {
    // The producer-side half of the C-005 §7 genericity test. growth-core rejects a growth field
    // on arrival; this stops one being emitted in the first place.
    it('emits only the fields the contract allows', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(Object.keys(sent(broker)).sort()).toEqual(
        ['correlationId', 'dataClass', 'eventId', 'eventType', 'eventVersion', 'occurredAt', 'producer', 'payload'].sort(),
      );
      expect(Object.keys(sent(broker).payload).sort()).toEqual(
        ['applicationContext', 'correlationId', 'email', 'registeredAt', 'registrationMethod', 'userId'].sort(),
      );
    });

    it('carries no workspaceId — that is growth tenancy, not ecosystem identity', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered(registration());

      expect(sent(broker)).not.toHaveProperty('workspaceId');
      expect(sent(broker).payload).not.toHaveProperty('workspaceId');
    });

    it('ignores a growth field even if a caller tries to smuggle one in', async () => {
      const broker = fakeBroker();
      const publisher = new AuthEventPublisher(loggerStub(), broker.connect);

      await publisher.publishUserRegistered({
        ...registration(),
        gsid: 'should-never-appear',
        experimentId: 'exp-1',
      } as never);

      expect(JSON.stringify(sent(broker))).not.toContain('should-never-appear');
      expect(JSON.stringify(sent(broker))).not.toContain('exp-1');
    });
  });
});
