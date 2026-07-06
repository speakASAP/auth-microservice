import { BadRequestException } from '@nestjs/common';
import { RoleScope } from './entities/role.entity';
import { RolesService } from './roles.service';

describe('RolesService first-visit application access', () => {
  function makeService(options: {
    application?: any;
    role?: any;
    existing?: any;
  } = {}) {
    const applicationsRepository = {
      findOne: jest.fn(async () => Object.prototype.hasOwnProperty.call(options, 'application') ? options.application : {
        id: 'app-1',
        name: 'marathon',
        isActive: true,
        domain: 'marathon.alfares.cz',
      }),
    };
    const rolesRepository = {
      findOne: jest.fn(async () => Object.prototype.hasOwnProperty.call(options, 'role') ? options.role : {
        id: 'role-1',
        name: 'user',
        scope: RoleScope.APPLICATION,
        applicationId: 'app-1',
        isActive: true,
        domain: 'marathon.alfares.cz',
      }),
    };
    const userRolesRepository = {
      findOne: jest.fn(async () => Object.prototype.hasOwnProperty.call(options, 'existing') ? options.existing : null),
      create: jest.fn((payload: any) => ({ id: 'assignment-1', ...payload })),
      save: jest.fn(async (payload: any) => payload),
    };
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const service = new RolesService(
      rolesRepository as any,
      userRolesRepository as any,
      applicationsRepository as any,
      logger as any,
    );

    return { service, applicationsRepository, rolesRepository, userRolesRepository };
  }

  it('assigns an existing active application user role idempotently for first visit', async () => {
    const { service, applicationsRepository, rolesRepository, userRolesRepository } = makeService();

    const result = await service.assignDefaultApplicationAccess('user-1', 'Marathon', 'user-1', 'https://marathon.alfares.cz/profile');

    expect(applicationsRepository.findOne).toHaveBeenCalledWith({ where: { name: 'marathon' } });
    expect(rolesRepository.findOne).toHaveBeenCalledWith({
      where: {
        name: 'user',
        scope: RoleScope.APPLICATION,
        applicationId: 'app-1',
        isActive: true,
      },
    });
    expect(userRolesRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      roleId: 'role-1',
      applicationId: 'app-1',
      grantedBy: 'user-1',
    });
    expect(result).toEqual({ assigned: true, role: 'app:marathon:user', applicationId: 'app-1' });
  });

  it('treats an existing non-expired assignment as success without duplicating it', async () => {
    const { service, userRolesRepository } = makeService({
      existing: {
        id: 'assignment-1',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const result = await service.assignDefaultApplicationAccess('user-1', 'marathon', 'user-1');

    expect(userRolesRepository.create).not.toHaveBeenCalled();
    expect(userRolesRepository.save).not.toHaveBeenCalled();
    expect(result).toEqual({ assigned: false, role: 'app:marathon:user', applicationId: 'app-1' });
  });

  it('fails closed when return_url does not match a configured application domain', async () => {
    await expect(makeService().service.assignDefaultApplicationAccess('user-1', 'marathon', 'user-1', 'https://catalog.alfares.cz/auth/callback')).rejects.toThrow(BadRequestException);
  });

  it('fails closed for unknown applications, missing default user roles, and expired assignments', async () => {
    await expect(makeService({ application: null }).service.assignDefaultApplicationAccess('user-1', 'missing')).rejects.toThrow(BadRequestException);
    await expect(makeService({ role: null }).service.assignDefaultApplicationAccess('user-1', 'marathon')).rejects.toThrow(BadRequestException);
    await expect(makeService({ existing: { expiresAt: new Date(Date.now() - 60_000) } }).service.assignDefaultApplicationAccess('user-1', 'marathon')).rejects.toThrow(BadRequestException);
  });
});
