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

  @Get()
  async getAllUsers(@Request() req) {
    this.logger.log(`Admin user ${req.user.email} requested user list`, 'AdminUsersController');
    const users = await this.usersService.findAllForAdminList();
    return {
      success: true,
      users,
      count: users.length,
    };
  }

  @Get(':id')
  async getUser(@Param('id') id: string, @Request() req) {
    this.logger.log(`Admin user ${req.user.email} requested user ${id}`, 'AdminUsersController');
    const user = await this.usersService.findById(id);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    const { password, ...sanitized } = user;
    return { success: true, user: sanitized };
  }

  @Post()
  async createUser(@Body() createUserDto: any, @Request() req) {
    this.logger.log(`Admin user ${req.user.email} creating new user`, 'AdminUsersController');
    const { email, password, firstName, lastName, phone, isActive } = createUserDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
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
    this.logger.log(`Admin user ${req.user.email} created user ${user.id}`, 'AdminUsersController');
    return { success: true, user: sanitized };
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: any, @Request() req) {
    this.logger.log(`Admin user ${req.user.email} updating user ${id}`, 'AdminUsersController');
    const user = await this.usersService.findById(id);
    if (!user) {
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
    this.logger.log(`Admin user ${req.user.email} updated user ${id}`, 'AdminUsersController');
    return { success: true, user: sanitized };
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Request() req) {
    this.logger.log(`Admin user ${req.user.email} deleting user ${id}`, 'AdminUsersController');
    const user = await this.usersService.findById(id);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    await this.usersService.delete(id);
    this.logger.log(`Admin user ${req.user.email} deleted user ${id}`, 'AdminUsersController');
    return { success: true, message: 'User deleted successfully' };
  }

  @Put(':id/toggle-active')
  async toggleActive(@Param('id') id: string, @Request() req) {
    this.logger.log(`Admin user ${req.user.email} toggling active status for user ${id}`, 'AdminUsersController');
    const user = await this.usersService.toggleActive(id);
    const { password: _, ...sanitized } = user;
    return { success: true, user: sanitized };
  }
}
