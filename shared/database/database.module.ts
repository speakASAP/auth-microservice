/**
 * Database Module for Auth Microservice
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'db-server-postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'dbadmin',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'auth',
      entities: [User],
      synchronize: process.env.DB_SYNC === 'true',
      logging: process.env.NODE_ENV === 'development',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

