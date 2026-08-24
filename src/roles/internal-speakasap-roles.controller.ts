import {
  BadRequestException,
  Controller,
  Headers,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';
import { RolesService } from './roles.service';

export const SPEAKASAP_APPLICATION_NAME = 'speakasap';
export const SPEAKASAP_TEACHER_ROLE_NAME = 'teacher';

/**
 * Scoped internal grant path for the speakasap teacher role.
 *
 * Why this exists rather than reusing `POST /auth/admin/users/:userId/roles`: that route
 * is gated on `global:superadmin`, a *user* role. Letting user-service call it would mean
 * issuing superadmin to a machine account, and a compromise of user-service would then be
 * able to assign any role in any of the applications Auth serves — including superadmin.
 *
 * The role granted here is fixed in code. There is no request field, header, or path
 * segment that can redirect the grant to another role or another application, so the
 * blast radius of this token is exactly one role.
 *
 * Callers: user-service, when portal sync upserts a teacher row.
 */
@Controller('internal/roles/speakasap')
@UseGuards(InternalServiceGuard)
export class InternalSpeakasapRolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('teacher/:userId')
  async grantTeacher(
    @Param('userId') userId: string,
    @Headers() headers: Record<string, string | undefined>,
  ): Promise<{ userId: string; role: string; granted: boolean }> {
    const targetUserId = String(userId ?? '').trim();
    if (!targetUserId) {
      throw new BadRequestException('userId is required');
    }

    const role = await this.rolesService.findByNameForApplication(
      SPEAKASAP_TEACHER_ROLE_NAME,
      SPEAKASAP_APPLICATION_NAME,
    );
    // A missing role row means the Auth deployment is not seeded as expected. Reporting it
    // as 404 keeps the caller's sync loud instead of quietly skipping every grant.
    if (!role) {
      throw new NotFoundException(
        `Role '${SPEAKASAP_TEACHER_ROLE_NAME}' for application '${SPEAKASAP_APPLICATION_NAME}' not found`,
      );
    }

    const roleString = `app:${SPEAKASAP_APPLICATION_NAME}:${SPEAKASAP_TEACHER_ROLE_NAME}`;
    // Portal sync re-sends the full roster every run, so an existing grant is the normal
    // case. Checking first keeps that a 200 with granted:false instead of assignRoleToUser's
    // 409, without having to swallow conflicts that might mean something else.
    const alreadyGranted = await this.rolesService.hasRoleAssignment(
      targetUserId,
      role.id,
      role.applicationId,
    );
    if (alreadyGranted) {
      return { userId: targetUserId, role: roleString, granted: false };
    }

    const actor = `internal:${String(headers['x-service-name'] ?? '').trim() || 'unknown-service'}`;
    await this.rolesService.assignRoleToUser(
      targetUserId,
      role.id,
      role.applicationId,
      actor,
      undefined,
    );

    return { userId: targetUserId, role: roleString, granted: true };
  }
}
