/**
 * Applications Controller
 * Handles application registration and management
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Optional,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationType } from './entities/application.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('auth/admin/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('register')
  @UseGuards(RolesGuard)
  @Roles('global:superadmin', 'global:platform_admin')
  async register(@Body() body: {
    name: string;
    displayName?: string;
    type: ApplicationType;
    domain?: string;
    description?: string;
  }) {
    return this.applicationsService.registerOrUpdate(body);
  }

  // Public registration endpoint for initial setup (no auth required if no apps exist)
  @Post('register-public')
  async registerPublic(@Body() body: {
    name: string;
    displayName?: string;
    type: ApplicationType;
    domain?: string;
    description?: string;
  }) {
    // Check if any applications exist
    const existingApps = await this.applicationsService.findAll();
    
    // If applications exist, require auth
    if (existingApps.length > 0) {
      throw new Error('Public registration is only allowed during initial setup. Use /auth/admin/applications/register with authentication.');
    }

    // Allow registration during initial setup
    return this.applicationsService.registerOrUpdate(body);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('global:superadmin', 'global:platform_admin')
  async findAll() {
    return this.applicationsService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('global:superadmin', 'global:platform_admin')
  async findById(@Param('id') id: string) {
    return this.applicationsService.findById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('global:superadmin')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{
      displayName: string;
      type: ApplicationType;
      domain: string;
      description: string;
      isActive: boolean;
    }>,
  ) {
    return this.applicationsService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('global:superadmin')
  async delete(@Param('id') id: string) {
    await this.applicationsService.delete(id);
    return { message: 'Application deleted successfully' };
  }
}
