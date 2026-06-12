/**
 * Admin Roles Controller
 * Handles role management and user role assignments
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from '../roles/roles.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('auth/admin')
@UseGuards(RolesGuard)
export class AdminRolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @Roles('global:superadmin', 'global:platform_admin')
  async getAllRoles() {
    return this.rolesService.findAll();
  }

  @Get('users/:userId/roles')
  @Roles('global:superadmin', 'global:platform_admin')
  async getUserRoles(@Param('userId') userId: string) {
    const roles = await this.rolesService.getUserRoles(userId);
    return { userId, roles };
  }

  @Post('users/:userId/roles')
  @Roles('global:superadmin')
  async assignRole(
    @Param('userId') userId: string,
    @Body() body: { roleId: string; applicationId?: string; expiresAt?: string },
    @CurrentUser() currentUser: any,
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.rolesService.assignRoleToUser(
      userId,
      body.roleId,
      body.applicationId,
      currentUser.id,
      expiresAt,
    );
  }

  @Delete('users/:userId/roles/:roleId')
  @Roles('global:superadmin')
  async removeRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() currentUser: any,
    @Body() body?: { applicationId?: string },
  ) {
    await this.rolesService.removeRoleFromUser(userId, roleId, body?.applicationId, currentUser.id);
    return { message: 'Role removed successfully' };
  }
}
