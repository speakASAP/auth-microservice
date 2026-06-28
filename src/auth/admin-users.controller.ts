/**
 * Admin Users Controller
 * Provides CRUD operations for user management in admin panel
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { LoggerService } from '../../shared/logger/logger.service';
import * as bcrypt from 'bcrypt';

@Controller('auth/admin/users')
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly logger: LoggerService,
  ) {}

  private audit(
    operation: string,
    outcome: string,
    details: Record<string, string | number | boolean | undefined | null>,
  ): void {
    const message = Object.entries({
      service: 'auth-microservice',
      operation,
      outcome,
      ...details,
    })
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${String(value).replace(/\s+/g, '_')}`)
      .join(' ');
    this.logger.log(message, 'AdminAudit');
  }

  @Get()
  async getAllUsers(
    @Request() req,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
    @Query('search') searchParam?: string,
    @Query('applicationId') applicationIdParam?: string,
    @Query('status') statusParam?: string,
    @Query('verified') verifiedParam?: string,
    @Query('adminOnly') adminOnlyParam?: string,
  ) {
    const startedAt = Date.now();
    const requestedLimit = Number.parseInt(limitParam || '100', 10);
    const requestedOffset = Number.parseInt(offsetParam || '0', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
    const search = (searchParam || '').trim().slice(0, 120);
    const applicationId = (applicationIdParam || '').trim();
    const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : undefined;
    const verified = verifiedParam === 'yes' || verifiedParam === 'no' ? verifiedParam : undefined;
    const adminOnly = adminOnlyParam === 'yes';
    const [users, count] = await this.usersService.findAdminListPage(limit, offset, {
      search,
      applicationId,
      status,
      verified,
      adminOnly,
    });
    this.audit('admin_user_list', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      count,
      limit,
      offset,
      search_filter: Boolean(search),
      application_filter: Boolean(applicationId),
      status_filter: status,
      verified_filter: verified,
      admin_only_filter: adminOnly,
      duration_ms: Date.now() - startedAt,
    });
    return {
      success: true,
      users,
      count,
      limit,
      offset,
    };
  }

  @Get('application-admins')
  async getApplicationAdmins(@Request() req) {
    const startedAt = Date.now();
    const applications = await this.usersService.findApplicationAdmins();
    this.audit('admin_application_admins_list', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      application_count: applications.length,
      duration_ms: Date.now() - startedAt,
    });
    return { success: true, applications };
  }

  @Get(':id')
  async getUser(@Param('id') id: string, @Request() req) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(id);
    if (!user) {
      this.audit('admin_user_get', 'not_found', {
        actor: req.user.email,
        actor_id: req.user.id,
        target_user_id: id,
        duration_ms: Date.now() - startedAt,
      });
      return { success: false, message: 'User not found' };
    }
    const { password, ...sanitized } = user;
    this.audit('admin_user_get', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      target_user_id: id,
      duration_ms: Date.now() - startedAt,
    });
    return { success: true, user: sanitized };
  }

  @Post()
  async createUser(@Body() createUserDto: any, @Request() req) {
    const startedAt = Date.now();
    const { email, password, firstName, lastName, phone, isActive } = createUserDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      this.audit('admin_user_create', 'failure', {
        actor: req.user.email,
        actor_id: req.user.id,
        target_identifier: email,
        reason: 'email_exists',
        duration_ms: Date.now() - startedAt,
      });
      return { success: false, message: 'User with this email already exists' };
    }

    // Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      isActive: isActive !== undefined ? isActive : true,
      isVerified: false,
    });

    const { password: _, ...sanitized } = user;
    this.audit('admin_user_create', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      target_identifier: email,
      target_user_id: user.id,
      duration_ms: Date.now() - startedAt,
    });
    return { success: true, user: sanitized };
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: any, @Request() req) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(id);
    if (!user) {
      this.audit('admin_user_update', 'not_found', {
        actor: req.user.email,
        actor_id: req.user.id,
        target_user_id: id,
        duration_ms: Date.now() - startedAt,
      });
      return { success: false, message: 'User not found' };
    }

    const updateData: any = {};
    if (updateUserDto.email !== undefined) updateData.email = updateUserDto.email;
    if (updateUserDto.firstName !== undefined) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.phone !== undefined) updateData.phone = updateUserDto.phone;
    if (updateUserDto.isActive !== undefined) updateData.isActive = updateUserDto.isActive;
    if (updateUserDto.isVerified !== undefined) updateData.isVerified = updateUserDto.isVerified;

    // Update password if provided
    if (updateUserDto.password) {
      const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
      await this.usersService.updatePassword(id, hashedPassword);
    }

    const updatedUser = await this.usersService.update(id, updateData);
    const { password: _, ...sanitized } = updatedUser;
    this.audit('admin_user_update', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      target_user_id: id,
      password_changed: Boolean(updateUserDto.password),
      duration_ms: Date.now() - startedAt,
    });
    return { success: true, user: sanitized };
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Request() req) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(id);
    if (!user) {
      this.audit('admin_user_delete', 'not_found', {
        actor: req.user.email,
        actor_id: req.user.id,
        target_user_id: id,
        duration_ms: Date.now() - startedAt,
      });
      return { success: false, message: 'User not found' };
    }
    await this.usersService.delete(id);
    this.audit('admin_user_delete', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      target_user_id: id,
      duration_ms: Date.now() - startedAt,
    });
    return { success: true, message: 'User deleted successfully' };
  }

  @Put(':id/toggle-active')
  async toggleActive(@Param('id') id: string, @Request() req) {
    const startedAt = Date.now();
    const user = await this.usersService.toggleActive(id);
    const { password: _, ...sanitized } = user;
    this.audit('admin_user_toggle_active', 'success', {
      actor: req.user.email,
      actor_id: req.user.id,
      target_user_id: id,
      is_active: user.isActive,
      duration_ms: Date.now() - startedAt,
    });
    return { success: true, user: sanitized };
  }
}
