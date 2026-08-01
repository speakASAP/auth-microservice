import { UsersService } from './users.service';
import { LegacyIdentityMappingStatus } from './entities/legacy-identity-mapping.entity';

function makeService(overrides: {
  mappingFindOne?: jest.Mock;
  mappingSave?: jest.Mock;
  userFindByEmail?: jest.Mock;
  userSave?: jest.Mock;
}) {
  const mappingRepo = {
    findOne: overrides.mappingFindOne ?? jest.fn().mockResolvedValue(null),
    save: overrides.mappingSave ?? jest.fn(async (x) => x),
    create: jest.fn((x) => x),
  };
  const userRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: () => ({ getOne: overrides.userFindByEmail ?? jest.fn().mockResolvedValue(null) }),
    })),
    save: overrides.userSave ?? jest.fn(async (x) => ({ ...x, id: 'new-uuid' })),
    create: jest.fn((x) => x),
  };
  return {
    service: new UsersService(userRepo as any, {} as any, {} as any, mappingRepo as any),
    mappingRepo,
    userRepo,
  };
}

describe('resolveOrProvisionLegacyUser', () => {
  const input = {
    legacySystem: 'speakasap-portal',
    legacyUserId: 310740,
    email: 'Student@Example.COM',
    firstName: 'A',
    lastName: 'B',
  };

  it('returns the existing mapping without writing anything', async () => {
    const mappingSave = jest.fn();
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue({ authUserId: 'existing-uuid' }),
      mappingSave,
    });
    const result = await service.resolveOrProvisionLegacyUser(input);
    expect(result).toEqual({ authUserId: 'existing-uuid', provisioned: false });
    expect(mappingSave).not.toHaveBeenCalled();
  });

  it('links an existing auth user found by normalized email, without creating a user', async () => {
    const userSave = jest.fn();
    const mappingSave = jest.fn(async (x) => x);
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue(null),
      userFindByEmail: jest.fn().mockResolvedValue({ id: 'found-uuid' }),
      userSave,
      mappingSave,
    });
    const result = await service.resolveOrProvisionLegacyUser(input);
    expect(result).toEqual({ authUserId: 'found-uuid', provisioned: true });
    expect(userSave).not.toHaveBeenCalled();
    expect(mappingSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: LegacyIdentityMappingStatus.MAPPED }),
    );
  });

  it('creates a user when no email match exists, and records status CREATED', async () => {
    const mappingSave = jest.fn(async (x) => x);
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue(null),
      userFindByEmail: jest.fn().mockResolvedValue(null),
      mappingSave,
    });
    const result = await service.resolveOrProvisionLegacyUser(input);
    expect(result).toEqual({ authUserId: 'new-uuid', provisioned: true });
    expect(mappingSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: LegacyIdentityMappingStatus.CREATED }),
    );
  });

  it('normalizes the email before matching and storing', async () => {
    const mappingSave = jest.fn(async (x) => x);
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue(null),
      userFindByEmail: jest.fn().mockResolvedValue(null),
      mappingSave,
    });
    await service.resolveOrProvisionLegacyUser(input);
    expect(mappingSave).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedEmail: 'student@example.com' }),
    );
  });

  it('is idempotent: a second call after provisioning finds the mapping', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ authUserId: 'new-uuid' });
    const { service } = makeService({
      mappingFindOne: findOne,
      userFindByEmail: jest.fn().mockResolvedValue(null),
    });
    const first = await service.resolveOrProvisionLegacyUser(input);
    const second = await service.resolveOrProvisionLegacyUser(input);
    expect(first.provisioned).toBe(true);
    expect(second).toEqual({ authUserId: 'new-uuid', provisioned: false });
  });

  it('rejects a blank email rather than creating an unusable user', async () => {
    const { service } = makeService({ mappingFindOne: jest.fn().mockResolvedValue(null) });
    await expect(
      service.resolveOrProvisionLegacyUser({ ...input, email: '   ' }),
    ).rejects.toThrow(/email/i);
  });
});
