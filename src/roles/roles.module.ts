/**
 * Roles Module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { InternalSpeakasapRolesController } from './internal-speakasap-roles.controller';
import { Role } from './entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { Application } from '../applications/entities/application.entity';
import { LoggerModule } from '../../shared/logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, UserRole, Application]),
    LoggerModule,
  ],
  controllers: [InternalSpeakasapRolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
