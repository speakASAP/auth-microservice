/**
 * Admin Module
 * Handles admin operations for RBAC system
 */

import { Module } from '@nestjs/common';
import { AdminRolesController } from './admin-roles.controller';
import { RolesModule } from '../roles/roles.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [RolesModule, AuthModule, UsersModule],
  controllers: [AdminRolesController],
})
export class AdminModule {}
