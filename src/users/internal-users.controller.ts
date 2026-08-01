import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Query, UseGuards } from '@nestjs/common';
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

  /**
   * The reverse of `by-legacy-id`: auth UUID -> legacy id.
   *
   * education-service's drill runner needs this direction. The JWT carries
   * `AuthContextUser.id` (a UUID) while `DrillAssignment.studentId` is the legacy Django
   * integer, and neither `by-legacy-id` nor `resolve-or-provision-legacy` returns it —
   * both map the other way (contract C9's direction).
   *
   * A blank `authUserId` is rejected rather than passed through: an empty filter would
   * scan every mapping in the system and return an arbitrary one.
   *
   * An ambiguous mapping surfaces as the service's 409, not as a 404. "No mapping" and
   * "several conflicting mappings" call for different human responses, and flattening
   * them would hide a data defect behind a routine not-found.
   */
  @Get('by-auth-user')
  async byAuthUser(@Query('system') system: string, @Query('authUserId') authUserId: string) {
    if (!system) {
      throw new BadRequestException('system is required');
    }
    if (!authUserId) {
      throw new BadRequestException('authUserId is required');
    }
    const mapping = await this.usersService.findLegacyIdByAuthUser(system, authUserId);
    if (!mapping) {
      throw new NotFoundException('Legacy mapping not found');
    }
    return { legacyUserId: mapping.legacyUserId };
  }

  /** Contract C9. Shape mirrors `ResolveLegacyUserRequest` in shared/contracts/drills.contracts.ts. */
  @Post('resolve-or-provision-legacy')
  async resolveOrProvisionLegacy(
    @Body() body: { system: string; legacyUserId: number; email: string; firstName?: string; lastName?: string },
  ) {
    const numericId = Number(body?.legacyUserId);
    if (!body?.system) {
      throw new BadRequestException('system is required');
    }
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException('numeric legacyUserId is required');
    }
    return this.usersService.resolveOrProvisionLegacyUser({
      legacySystem: body.system,
      legacyUserId: numericId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    });
  }
}
