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
import { InternalServiceGuard } from './guards/internal-service.guard';
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
    // TASK-KEY-F3 step 3: the signing algorithm is chosen once, here. Under RS256 the
    // private key signs and `secret` remains only so tokens minted before the flip
    // (7d access / 30d refresh) still verify. `getSigningConfig()` throws rather than
    // downgrading if RS256 is requested without usable key material.
    JwtModule.register((() => {
      const cfg = getSigningConfig();
      // eslint-disable-next-line no-console
      console.log(
        `[auth] JWT signing algorithm: ${cfg.algorithm}${cfg.keyid ? ` (kid=${cfg.keyid})` : ''}`,
      );
      return {
        ...(cfg.secret ? { secret: cfg.secret } : {}),
        ...(cfg.privateKey ? { privateKey: cfg.privateKey } : {}),
        signOptions: {
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          algorithm: cfg.algorithm,
          ...(cfg.keyid ? { keyid: cfg.keyid } : {}),
        },
      };
    })()),
  ],
  controllers: [AuthController, AdminUsersController, JwksController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    InternalServiceGuard,
    // Per-route gates for /auth/internal/*. Each resolves roles from the
    // database, so a revoked role stops working immediately rather than at exp.
    InternalEmailCheckGuard,
    InternalMagicLinkGuard,
    InternalPreferencesGuard,
  ],
  exports: [AuthService, RolesGuard, JwtModule],
})
export class AuthModule {}
