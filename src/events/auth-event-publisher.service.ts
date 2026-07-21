import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { v5 as uuidv5 } from 'uuid';
import { LoggerService } from '../../shared/logger/logger.service';

/**
 * Ecosystem convention: one durable topic exchange per producing service, event type as the
 * routing key (`catalog.events`, `orders.events`, `growth.events`). Consumers bind what they want.
 */
export const AUTH_EVENTS_EXCHANGE = 'auth.events';
export const USER_REGISTERED_V1 = 'auth.user.registered.v1';

/**
 * Namespace for deriving a registration's event id from its user id. Fixed forever: changing it
 * would make every future event a "new" registration for users who already have one.
 */
const REGISTRATION_ID_NAMESPACE = '6f1c9b2a-3d4e-5a6b-8c7d-9e0f1a2b3c4d';

export type RegistrationMethod = 'password' | 'oauth' | 'magic_link';

/**
 * What a caller supplies. Deliberately narrow: there is no field here through which a growth
 * concept could reach the event, and the builder below copies these one by one rather than
 * spreading, so an extra property on the argument object cannot leak into the payload.
 */
export interface UserRegisteredInput {
  userId: string;
  registrationMethod: RegistrationMethod;
  email?: string | null;
  phone?: string | null;
  /** Opaque, round-tripped through `state`. auth neither interprets nor stores it. */
  correlationId?: string | null;
  applicationContext?: string | null;
}

export type AmqpConnect = (url: string) => Promise<AmqpConnection>;

export interface AmqpConnection {
  createConfirmChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
  on?(event: string, listener: (err?: unknown) => void): void;
}

export interface AmqpChannel {
  assertExchange(exchange: string, type: 'topic', options: { durable: true }): Promise<unknown>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Record<string, unknown>,
  ): boolean;
  waitForConfirms(): Promise<void>;
  close(): Promise<void>;
  on?(event: string, listener: (err?: unknown) => void): void;
}

const defaultConnect: AmqpConnect = async (url) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const amqp = require('amqplib') as { connect(url: string): Promise<AmqpConnection> };
  return amqp.connect(url);
};

/**
 * Publishes `auth.user.registered.v1` (EP-005 W3).
 *
 * **This must never be able to break authentication.** `auth-microservice` signs in every
 * application in the ecosystem; a RabbitMQ outage stopping registrations would be a far worse
 * failure than the missing analytics event it was trying to record. Every path here therefore
 * resolves, and a failure is logged with the complete envelope instead of thrown.
 *
 * That logging is not decoration. There is no outbox in `auth-microservice` — adding one would
 * mean a new table, and this service has no migration runner — so a failed publish is a lost
 * conversion unless the envelope survives somewhere it can be replayed from. See TASKS.md.
 *
 * **The event is generic and must stay that way.** No `gsid`, no `experimentId`, no
 * `workspaceId`: growth resolves its own tenancy on consumption. Putting a growth concept into
 * shared infrastructure couples every future consumer to one experiment, and there is no quiet
 * way to withdraw it later (EP-005 W3, C-005 §1).
 */
@Injectable()
export class AuthEventPublisher implements OnModuleDestroy {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private connecting: Promise<AmqpChannel> | null = null;

  constructor(
    private readonly logger: LoggerService,
    // A seam for the specs, not a provider — `@Optional()` stops Nest trying to resolve the
    // emitted `Function` type from the container, which would fail at boot.
    @Optional() private readonly connect: AmqpConnect = defaultConnect,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  /**
   * Emits the registration event. Resolves whatever happens.
   *
   * The event id is derived from the user id, not random: `verifyMagicLink` runs on every
   * magic-link login rather than only the first, so a random id would report a fresh
   * registration each time somebody logged in. A derived id collides with the consumer's
   * primary key and is discarded as the duplicate it is — a person registers once.
   */
  async publishUserRegistered(input: UserRegisteredInput): Promise<void> {
    const envelope = this.buildEnvelope(input);

    try {
      const channel = await this.channelReady();
      channel.publish(
        AUTH_EVENTS_EXCHANGE,
        USER_REGISTERED_V1,
        Buffer.from(JSON.stringify(envelope)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: envelope.eventId,
          type: USER_REGISTERED_V1,
          timestamp: Date.now(),
        },
      );
      await channel.waitForConfirms();
    } catch (err) {
      this.forget();
      // The full envelope, so this line is enough to replay the event by hand.
      this.logger.error(
        `Failed to publish ${USER_REGISTERED_V1} for user ${envelope.payload.userId}: ` +
          `${describe(err)} — envelope: ${JSON.stringify(envelope)}`,
        err instanceof Error ? err.stack : '',
        'AuthEventPublisher',
      );
    }
  }

  /** Copies field by field: an unexpected property on `input` cannot reach the wire. */
  private buildEnvelope(input: UserRegisteredInput) {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      userId: input.userId,
      registrationMethod: input.registrationMethod,
      registeredAt: now,
    };
    // Absent rather than null: the schema forbids unknown shapes, and a null would fail
    // validation at the consumer — a conversion dropped silently.
    if (input.email) payload.email = input.email;
    if (input.phone) payload.phone = input.phone;
    if (input.correlationId) payload.correlationId = input.correlationId;
    if (input.applicationContext) payload.applicationContext = input.applicationContext;

    return {
      eventId: uuidv5(input.userId, REGISTRATION_ID_NAMESPACE),
      eventType: USER_REGISTERED_V1,
      eventVersion: 1,
      occurredAt: now,
      producer: 'auth-microservice',
      // Envelope-level tracing id. Distinct from payload.correlationId, which is the growth join
      // key and is absent for anyone who did not arrive through a landing page.
      correlationId: input.correlationId || uuidv5(`${input.userId}:envelope`, REGISTRATION_ID_NAMESPACE),
      dataClass: 'personal',
      payload,
    };
  }

  private async channelReady(): Promise<AmqpChannel> {
    if (this.channel) return this.channel;
    this.connecting ??= this.open().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async open(): Promise<AmqpChannel> {
    const url = process.env.RABBITMQ_URL;
    if (!url) throw new Error('[MISSING: RABBITMQ_URL]');

    const connection = await this.connect(url);
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(AUTH_EVENTS_EXCHANGE, 'topic', { durable: true });

    connection.on?.('close', () => this.forget());
    connection.on?.('error', () => this.forget());
    channel.on?.('close', () => this.forget());
    channel.on?.('error', () => this.forget());

    this.connection = connection;
    this.channel = channel;
    this.logger.log(`Publishing auth events to exchange ${AUTH_EVENTS_EXCHANGE}`, 'AuthEventPublisher');
    return channel;
  }

  private forget(): void {
    this.channel = null;
    this.connection = null;
  }

  private async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // Shutting down; a failure to close cleanly is not worth reporting.
    } finally {
      this.forget();
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
