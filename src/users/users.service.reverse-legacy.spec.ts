import { UsersService } from './users.service';

function makeService(mappingFind: jest.Mock) {
  const mappingRepo = {
    find: mappingFind,
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
  };
  const userRepo = {
    createQueryBuilder: jest.fn(() => ({ where: () => ({ getOne: jest.fn() }) })),
    save: jest.fn(),
    create: jest.fn(),
  };
  return {
    service: new UsersService(userRepo as any, {} as any, {} as any, mappingRepo as any),
    mappingRepo,
  };
}

/**
 * The reverse of `findLegacyMapping`: auth UUID -> legacy id.
 *
 * education-service's drill runner needs it because the JWT carries
 * `AuthContextUser.id` (a UUID) while `DrillAssignment.studentId` is the legacy
 * Django integer. Both routes shipped in Track H map the other way.
 */
describe('findLegacyIdByAuthUser', () => {
  it('returns the legacy id for a mapped auth user', async () => {
    const find = jest.fn().mockResolvedValue([
      { legacySystem: 'speakasap-portal', legacyUserId: 310740, authUserId: 'auth-1' },
    ]);
    const { service, mappingRepo } = makeService(find);

    const result = await service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1');

    expect(result).toEqual({ legacyUserId: 310740, legacyTeacherId: null });
    expect(mappingRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { legacySystem: 'speakasap-portal', authUserId: 'auth-1' } }),
    );
  });

  it('returns null when the auth user has no mapping in that system', async () => {
    const { service } = makeService(jest.fn().mockResolvedValue([]));

    await expect(service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1')).resolves.toBeNull();
  });

  /**
   * The unique key is (legacySystem, legacyUserId) — NOT authUserId. Two legacy rows
   * pointing at one auth user is therefore representable, and it happens when a legacy
   * account was duplicated before the merge. Picking one arbitrarily would hand a
   * student the other account's assignments and their answers, silently and
   * differently on each call depending on row order.
   */
  it('refuses to guess when one auth user maps to several legacy ids', async () => {
    const find = jest.fn().mockResolvedValue([
      { legacySystem: 'speakasap-portal', legacyUserId: 310740, authUserId: 'auth-1' },
      { legacySystem: 'speakasap-portal', legacyUserId: 998877, authUserId: 'auth-1' },
    ]);
    const { service } = makeService(find);

    await expect(service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1')).rejects.toThrow(
      /ambiguous/i,
    );
  });

  it('ignores rows whose mapping was never completed', async () => {
    const find = jest.fn().mockResolvedValue([
      { legacySystem: 'speakasap-portal', legacyUserId: 310740, authUserId: 'auth-1' },
      { legacySystem: 'speakasap-portal', legacyUserId: null, authUserId: 'auth-1' },
    ]);
    const { service } = makeService(find);

    await expect(service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1')).resolves.toEqual({
      legacyUserId: 310740,
      legacyTeacherId: null,
    });
  });

  it('scopes the lookup to the requested legacy system', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const { service } = makeService(find);

    await service.findLegacyIdByAuthUser('some-other-system', 'auth-1');

    expect(find.mock.calls[0][0].where.legacySystem).toBe('some-other-system');
  });

  /**
   * `Lesson.teacherId` in the legacy portal is the **Teacher profile pk**, not the user
   * id — teacher 182 is user 3. Education-service resolved a teacher's login to the user
   * id and queried lessons with it, so a teacher saw another teacher's roster or none.
   * The mapping is auth's to own, so it travels with the identity rather than being
   * guessed downstream or passed in a URL.
   */
  describe('legacyTeacherId', () => {
    it('returns the teacher profile id alongside the user id', async () => {
      const { service } = makeService(
        jest.fn().mockResolvedValue([{ legacyUserId: 3, legacyTeacherId: 182 }]),
      );

      await expect(service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1')).resolves.toEqual({
        legacyUserId: 3,
        legacyTeacherId: 182,
      });
    });

    it('returns null for a user who is not a teacher, rather than omitting the field', async () => {
      // An explicit null says "resolved, not a teacher". A missing key is
      // indistinguishable from an older auth that does not know about teachers.
      const { service } = makeService(
        jest.fn().mockResolvedValue([{ legacyUserId: 42, legacyTeacherId: null }]),
      );

      await expect(service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1')).resolves.toEqual({
        legacyUserId: 42,
        legacyTeacherId: null,
      });
    });

    it('treats a non-integer teacher id as absent', async () => {
      const { service } = makeService(
        jest.fn().mockResolvedValue([{ legacyUserId: 3, legacyTeacherId: 'nope' }]),
      );

      await expect(service.findLegacyIdByAuthUser('speakasap-portal', 'auth-1')).resolves.toEqual({
        legacyUserId: 3,
        legacyTeacherId: null,
      });
    });
  });
});
