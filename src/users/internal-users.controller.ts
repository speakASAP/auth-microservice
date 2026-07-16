import { BadRequestException, Controller, Get, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';
import { UsersService } from './users.service';

@Controller('internal/users')
@UseGuards(InternalServiceGuard)
export class InternalUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('by-legacy-id')
  async byLegacyId(@Query('system') system: string, @Query('legacyUserId') legacyUserId: string) {
    const numericId = Number(legacyUserId);
    if (!system || !Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException('system and numeric legacyUserId are required');
    }
    const mapping = await this.usersService.findLegacyMapping(system, numericId);
    if (!mapping || !mapping.authUserId) {
      throw new NotFoundException('Legacy mapping not found');
    }
    return { authUserId: mapping.authUserId, normalizedEmail: mapping.normalizedEmail ?? null };
  }
}
