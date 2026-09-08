/**
 * Auth Module
 */

import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getSigningConfig } from './jwt-secret';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { JwksController } from './jwks.controller';
import { AdminUsersController } from './admin-users.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import {
  InternalEmailCheckGuard,
  InternalMagicLinkGuard,
  InternalPreferencesGuard,
} from './guards/internal-route.guards';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { AuthEventsModule } from '../events/auth-events.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MagicLinkToken } from './entities/magic-link-token.entity';
import { EmailChangeToken } from './entities/email-change-token.entity';
import { LegacyIdentityMapping } from '../users/entities/legacy-identity-mapping.entity';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    RolesModule,
    LoggerModule,
    AuthEventsModule,
    PassportModule,
    HttpModule,
    TypeOrmModule.forFeature([PasswordResetToken, MagicLinkToken, EmailChangeToken, LegacyIdentityMapping]),
    // RS256 only. getSigningConfig() throws if key material is missing.
    JwtModule.register((() => {
      const cfg = getSigningConfig();
      // eslint-disable-next-line no-console
      console.log(
        `[auth] JWT signing algorithm: ${cfg.algorithm}${cfg.keyid ? ` (kid=${cfg.keyid})` : ''}`,
      );
      return {
        privateKey: cfg.privateKey,
        signOptions: {
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          algorithm: cfg.algorithm,
          keyid: cfg.keyid,
        },
      };
    })()),
  ],
  controllers: [AuthController, AdminUsersController, JwksController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    // Per-route gates for /auth/internal/*. Each resolves roles from the
    // database, so a revoked role stops working immediately rather than at exp.
    InternalEmailCheckGuard,
    InternalMagicLinkGuard,
    InternalPreferencesGuard,
  ],
  exports: [AuthService, RolesGuard, JwtModule],
})
export class AuthModule {}
