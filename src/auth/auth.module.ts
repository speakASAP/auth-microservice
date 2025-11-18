/**
 * Auth Module
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Module({
  imports: [
    UsersModule,
    LoggerModule,
    PassportModule,
    HttpModule,
    TypeOrmModule.forFeature([PasswordResetToken]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

