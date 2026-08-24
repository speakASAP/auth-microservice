import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleScope } from './entities/role.entity';
import { RolesService } from './roles.service';
import {
  InternalSpeakasapRolesController,
  SPEAKASAP_APPLICATION_NAME,
  SPEAKASAP_TEACHER_ROLE_NAME,
} from './internal-speakasap-roles.controller';

describe('InternalSpeakasapRolesController', () => {
  let controller: InternalSpeakasapRolesController;
  const rolesService = {
    findByNameForApplication: jest.fn(),
    assignRoleToUser: jest.fn(),
    hasRoleAssignment: jest.fn(),
  };

  const TEACHER_ROLE = {
    id: 'e446e693-27d8-47c0-9e47-543263236884',
    name: SPEAKASAP_TEACHER_ROLE_NAME,
    scope: RoleScope.APPLICATION,
    applicationId: '0b670e72-5070-4c61-97bd-682c56547a90',
  };
  const USER_ID = 'e9c0e180-c837-404e-a954-a37b56241a80';

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalSpeakasapRolesController],
      providers: [{ provide: RolesService, useValue: rolesService }],
    }).compile();
    controller = moduleRef.get(InternalSpeakasapRolesController);
  });

  it('grants the speakasap teacher role to a user', async () => {
    rolesService.findByNameForApplication.mockResolvedValue(TEACHER_ROLE);
    rolesService.hasRoleAssignment.mockResolvedValue(false);
    rolesService.assignRoleToUser.mockResolvedValue({ id: 'ur-1' });

    const result = await controller.grantTeacher(USER_ID, { 'x-service-name': 'user-service' });

    expect(rolesService.findByNameForApplication).toHaveBeenCalledWith(
      SPEAKASAP_TEACHER_ROLE_NAME,
      SPEAKASAP_APPLICATION_NAME,
    );
    expect(rolesService.assignRoleToUser).toHaveBeenCalledWith(
      USER_ID,
      TEACHER_ROLE.id,
      TEACHER_ROLE.applicationId,
      'internal:user-service',
      undefined,
    );
    expect(result).toEqual({ userId: USER_ID, role: 'app:speakasap:teacher', granted: true });
  });

  /**
   * Portal sync re-sends the whole teacher roster on every run, so an already-granted
   * role is the common case, not an error. It must not surface as the service's 409 —
   * that would make a healthy sync look like a failing one.
   */
  it('is idempotent when the role is already assigned', async () => {
    rolesService.findByNameForApplication.mockResolvedValue(TEACHER_ROLE);
    rolesService.hasRoleAssignment.mockResolvedValue(true);

    const result = await controller.grantTeacher(USER_ID, { 'x-service-name': 'user-service' });

    expect(rolesService.assignRoleToUser).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: USER_ID, role: 'app:speakasap:teacher', granted: false });
  });

  /**
   * A missing role row is a broken deployment, not a per-request condition. It must be
   * loud: silently skipping the grant is exactly the failure mode that left teachers
   * without the role for weeks.
   */
  it('fails loudly when the teacher role row is missing', async () => {
    rolesService.findByNameForApplication.mockResolvedValue(null);

    await expect(
      controller.grantTeacher(USER_ID, { 'x-service-name': 'user-service' }),
    ).rejects.toThrow(NotFoundException);
    expect(rolesService.assignRoleToUser).not.toHaveBeenCalled();
  });

  it('rejects a blank userId', async () => {
    await expect(controller.grantTeacher('  ', { 'x-service-name': 'user-service' })).rejects.toThrow(
      BadRequestException,
    );
    expect(rolesService.findByNameForApplication).not.toHaveBeenCalled();
  });

  /**
   * The whole point of this endpoint over the superadmin admin API: the role is fixed in
   * code. There is no request field that can redirect the grant to another role.
   */
  it('resolves only the speakasap teacher role, never a caller-supplied one', async () => {
    rolesService.findByNameForApplication.mockResolvedValue(TEACHER_ROLE);
    rolesService.hasRoleAssignment.mockResolvedValue(false);
    rolesService.assignRoleToUser.mockResolvedValue({ id: 'ur-1' });

    await controller.grantTeacher(USER_ID, { 'x-service-name': 'user-service' });

    expect(rolesService.findByNameForApplication.mock.calls).toEqual([
      [SPEAKASAP_TEACHER_ROLE_NAME, SPEAKASAP_APPLICATION_NAME],
    ]);
  });
});
