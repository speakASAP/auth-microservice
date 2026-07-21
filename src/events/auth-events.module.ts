import { Module } from '@nestjs/common';
import { LoggerModule } from '../../shared/logger/logger.module';
import { AuthEventPublisher } from './auth-event-publisher.service';

/**
 * `auth-microservice`'s outbound events (EP-005 W3).
 *
 * Kept in its own module rather than inside AuthModule so that what this service publishes stays
 * legible from the outside: the ecosystem now consumes these, and a future reader looking for
 * "what does auth emit" should find one directory rather than a call buried in an 80KB service.
 */
@Module({
  imports: [LoggerModule],
  providers: [AuthEventPublisher],
  exports: [AuthEventPublisher],
})
export class AuthEventsModule {}
