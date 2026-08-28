import { BadRequestException, Body, Controller, forwardRef, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';
import { UsersService } from './users.service';

/**
 * Ceiling on one names-by-legacy-ids batch. Comfortably above the largest real roster
 * seen (teacher 10, 656 students) so a single page never needs splitting, and far below
 * anything that would let one caller pull the user table through this route.
 */
const MAX_LEGACY_ID_BATCH = 1000;

@Controller('internal/users')
@UseGuards(InternalServiceGuard)
export class InternalUsersController {
  constructor(
    private readonly usersService: UsersService,
    // forwardRef mirrors the UsersModule <-> AuthModule cycle; without it Nest cannot
    // resolve AuthService here and the app fails to boot rather than failing a test.
    @Inject(forwardRef(() => AuthService)) private readonly authService: AuthService,
  ) {}

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

  /**
   * Batch legacy id -> name. POST because the id list is unbounded in principle and a
   * few hundred ids do not belong in a query string.
   *
   * Added for education-service's teacher roster, which holds legacy `studentId`
   * integers and no names, so every student rendered as "Student 58" in the assignment
   * wizard. Unmapped ids are omitted rather than returned blank — see the service.
   *
   * The batch is capped: this is a lookup for a picker, not a bulk export of the user
   * table, and an uncapped `IN (...)` is a cheap way for one caller to hurt everyone.
   */
  @Post('names-by-legacy-ids')
  async namesByLegacyIds(@Body() body: { system: string; legacyUserIds: number[] }) {
    if (!body?.system) {
      throw new BadRequestException('system is required');
    }
    if (!Array.isArray(body?.legacyUserIds)) {
      throw new BadRequestException('legacyUserIds must be an array');
    }
    if (body.legacyUserIds.length > MAX_LEGACY_ID_BATCH) {
      throw new BadRequestException(
        `legacyUserIds may not exceed ${MAX_LEGACY_ID_BATCH} entries per request`,
      );
    }

    const ids = Array.from(
      new Set(body.legacyUserIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)),
    );

    return { users: await this.usersService.findNamesByLegacyIds(body.system, ids) };
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

  /**
   * Offboarding reconciliation for cv-tuning: "is this userId still a real account?"
   * and nothing else. Answers with `{ exists: true, userId }` for a hit and a bare 404
   * for a confirmed miss -- never email, profile fields, or any other row data, and
   * never a 200 with `exists: false` (a stale userId here is treated as not-found, not
   * as a fact worth a 200).
   */
  @Get(':userId/existence')
  async checkExistence(@Param('userId') userId: string) {
    const trimmed = (userId || '').trim();
    if (!this.isUuid(trimmed)) {
      throw new BadRequestException('userId must be a valid UUID');
    }

    const exists = await this.usersService.existsById(trimmed);
    if (!exists) {
      throw new NotFoundException('User not found');
    }

    return { exists: true, userId: trimmed };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Mint a session for an already-resolved user. Completes the speakasap portal SSO
   * handoff, whose steps are: portal signs a short-lived token → platform verifies it →
   * `resolve-or-provision-legacy` answers *who* → this answers *how they get in*.
   *
   * Without this route the handoff can identify a student and then do nothing with the
   * answer, which is what forced the platform to either fail or guess. It never guesses.
   *
   * Access token only, 12h, no refresh token — see `createSessionForUser`. The response
   * is built field by field rather than spread, so a future refresh token added upstream
   * cannot leak into a browser handoff by accident.
   */
  @Post(':userId/session')
  async createSession(@Param('userId') userId: string) {
    const trimmed = (userId || '').trim();
    if (!trimmed) {
      throw new BadRequestException('userId is required');
    }

    const session = await this.authService.createSessionForUser(trimmed);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      userId: session.userId,
    };
  }
}
