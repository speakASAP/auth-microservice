/**
 * Auth Module
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AdminUsersController } from './admin-users.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
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
    UsersModule,
    RolesModule,
    LoggerModule,
    AuthEventsModule,
    PassportModule,
    HttpModule,
    TypeOrmModule.forFeature([PasswordResetToken, MagicLinkToken, EmailChangeToken, LegacyIdentityMapping]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    }),
  ],
  controllers: [AuthController, AdminUsersController],
  providers: [AuthService, JwtStrategy, RolesGuard, InternalServiceGuard],
  exports: [AuthService, RolesGuard, JwtModule],
})
export class AuthModule {}
