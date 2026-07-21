import { Test } from '@nestjs/testing';
import { AuthEventsModule } from './auth-events.module';
import { AuthEventPublisher } from './auth-event-publisher.service';

/**
 * Builds the real container for the events module.
 *
 * Every other spec in W3 constructs its subject by hand, which proves the logic and nothing about
 * the wiring. A provider Nest cannot resolve — an emitted `Function` parameter type, a missing
 * module import — surfaces only when the container is built, which for `auth-microservice` means
 * a crash-looping pod, and a crash-looping auth pod is every application in the ecosystem unable
 * to log anyone in. Cheap to check here, expensive to discover there.
 */
describe('AuthEventsModule', () => {
  it('resolves the publisher from the container', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthEventsModule] }).compile();

    expect(moduleRef.get(AuthEventPublisher)).toBeInstanceOf(AuthEventPublisher);

    await moduleRef.close();
  });

  it('exports the publisher, so AuthModule can inject it', async () => {
    // AuthService now takes AuthEventPublisher as a constructor dependency. If this provider were
    // private to its module, auth would fail to start.
    const consumer = await Test.createTestingModule({
      imports: [AuthEventsModule],
      providers: [
        {
          provide: 'CONSUMER',
          inject: [AuthEventPublisher],
          useFactory: (publisher: AuthEventPublisher) => publisher,
        },
      ],
    }).compile();

    expect(consumer.get('CONSUMER')).toBeInstanceOf(AuthEventPublisher);

    await consumer.close();
  });
});
