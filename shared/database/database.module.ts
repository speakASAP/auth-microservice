/**
 * Database Module for Auth Microservice
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../src/users/entities/user.entity';
import { UserDeliveryAddress } from '../../src/users/entities/user-delivery-address.entity';
import { UserInvoiceProfile } from '../../src/users/entities/user-invoice-profile.entity';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { MagicLinkToken } from '../../src/auth/entities/magic-link-token.entity';
import { EmailChangeToken } from '../../src/auth/entities/email-change-token.entity';
import { Application } from '../../src/applications/entities/application.entity';
import { Role } from '../../src/roles/entities/role.entity';
import { UserRole } from '../../src/user-roles/entities/user-role.entity';
import { LegacyIdentityMapping } from '../../src/users/entities/legacy-identity-mapping.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'db-server-postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'dbadmin',
      password: typeof process.env.DB_PASSWORD === 'string' ? process.env.DB_PASSWORD : '',
      database: process.env.DB_NAME || 'auth',
      entities: [User, UserDeliveryAddress, UserInvoiceProfile, PasswordResetToken, MagicLinkToken, EmailChangeToken, Application, Role, UserRole, LegacyIdentityMapping],
      synchronize: process.env.DB_SYNC === 'true',
      logging: process.env.NODE_ENV === 'development',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
