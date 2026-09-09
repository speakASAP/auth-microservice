import { UsersService } from './users.service';

describe('UsersService', () => {
  function makeService() {
    const whereClauses: string[] = [];
    const query = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      andWhere: jest.fn((clause: string) => {
        whereClauses.push(clause);
        return query;
      }),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
      existsBy: jest.fn(),
      findOne: jest.fn(),
    };
    const walletRepository = {};

    return {
      service: new UsersService(repository as any, walletRepository as any, walletRepository as any, walletRepository as any),
      query,
      repository,
      whereClauses,
    };
  }

  it('quotes the reserved user alias in application filter subqueries', async () => {
    const { service, whereClauses } = makeService();

    await service.findAdminListPage(100, 0, { applicationId: 'app-1' });

    const applicationClause = whereClauses.find((clause) => clause.includes('FROM user_roles ur'));
    expect(applicationClause).toContain('ur."userId" = "user"."id"');
    expect(applicationClause).not.toContain('ur."userId" = user.id');
  });

  it('quotes the reserved user alias in app-admin filter subqueries', async () => {
    const { service, whereClauses } = makeService();

    await service.findAdminListPage(100, 0, {
      applicationId: 'app-1',
      adminOnly: true,
    });

    const adminClause = whereClauses.find((clause) => clause.includes('INNER JOIN roles role'));
    expect(adminClause).toContain('ur."userId" = "user"."id"');
    expect(adminClause).toContain('AND ur."applicationId" = :adminApplicationId');
    expect(adminClause).not.toContain('ur."userId" = user.id');
  });

  it('checks user existence without loading profile fields', async () => {
    const { service, repository } = makeService();
    repository.existsBy.mockResolvedValue(true);

    const exists = await service.existsById('e9c0e180-c837-404e-a954-a37b56241a80');

    expect(exists).toBe(true);
    expect(repository.existsBy).toHaveBeenCalledWith({ id: 'e9c0e180-c837-404e-a954-a37b56241a80' });
    expect(repository.findOne).not.toHaveBeenCalled();
  });
});
