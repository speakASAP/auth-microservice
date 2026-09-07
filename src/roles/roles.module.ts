/**
 * Roles Module
 */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { InternalSpeakasapRolesController } from './internal-speakasap-roles.controller';
import { Role } from './entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { Application } from '../applications/entities/application.entity';
import { LoggerModule } from '../../shared/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { InternalSpeakasapTeacherGrantGuard } from '../auth/guards/internal-route.guards';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, UserRole, Application]),
    LoggerModule,
    // Teacher-grant guard resolves the RS256 principal via UsersService.
    forwardRef(() => UsersModule),
  ],
  controllers: [InternalSpeakasapRolesController],
  providers: [RolesService, InternalSpeakasapTeacherGrantGuard],
  exports: [RolesService],
})
export class RolesModule {}
