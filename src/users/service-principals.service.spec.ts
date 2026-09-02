import { ServicePrincipalsService } from './service-principals.service';

/**
 * The inventory feed for the credential prober.
 *
 * Two production facts drive these tests, both discovered by querying the auth
 * database rather than reading the convention:
 *
 *  - 18 of the 42 active service principals do not match
 *    `svc-<caller>--<target>@internal.alfares.cz`. Selecting on the address
 *    would drop them without saying so, which is the same silent gap the prober
 *    exists to close.
 *  - The address does not reliably name the receiver. 14 of the 42 hold a role
 *    on the *caller* rather than the named target, so a prober trusting the
 *    address would query the wrong service and misread its answer.
 *
 * These stub the query builder, so they cover grouping and mismatch logic but
 * prove nothing about the SQL emitted — that is `service-principals.sql.spec.ts`,
 * added after a malformed select reached production as a 500.
 */
describe('ServicePrincipalsService', () => {
  const build = (rows: any[]) => {
    const query: any = {
      leftJoin: jest.fn(() => query),
      select: jest.fn(() => query),
      addSelect: jest.fn(() => query),
      where: jest.fn(() => query),
      andWhere: jest.fn(() => query),
      orderBy: jest.fn(() => query),
      getRawMany: jest.fn(async () => rows),
    };
    const repo = { createQueryBuilder: jest.fn(() => query) };
    return { service: new ServicePrincipalsService(repo as any), query };
  };

  const row = (over: any = {}) => ({
    id: 'u1',
    email: 'svc-monitoring--logging@internal.alfares.cz',
    isActive: true,
    roleName: 'readonly',
    roleScope: 'internal',
    appName: 'logging-microservice',
    expiresAt: null,
    ...over,
  });

  it('selects by userType, not by the address convention', async () => {
    const { service, query } = build([row()]);

    await service.listServicePrincipals();

    const [clause, params] = query.where.mock.calls[0];
    expect(clause).toContain('userType');
    expect(params).toMatchObject({ serviceType: 'service' });
    // An address filter here would silently drop the 18 off-convention
    // principals that exist in production today.
    expect(clause).not.toContain('internal.alfares.cz');
  });

  it('includes principals whose address is off the convention', async () => {
    const { service } = build([
      row({ id: 'u2', email: 'orders-action-admin@internal.invalid', appName: 'orders-microservice' }),
      row({ id: 'u3', email: 'suppliers-catalog-service@alfares.cz', appName: 'catalog-microservice' }),
    ]);

    const result = await service.listServicePrincipals();

    expect(result).toHaveLength(2);
    expect(result.every((p) => p.onConvention === false)).toBe(true);
  });

  it('flags a principal whose address names a target none of its grants match', async () => {
    // Real shape: the address says orders-microservice, the only grant is on
    // allegro-service. Probing the address-derived target would ask the wrong
    // service about this credential.
    const { service } = build([
      row({
        email: 'svc-allegro-service--orders-microservice@internal.alfares.cz',
        appName: 'allegro-service',
      }),
    ]);

    const [record] = await service.listServicePrincipals();

    expect(record.conventionTarget).toBe('orders-microservice');
    expect(record.grants[0].application).toBe('allegro-service');
    expect(record.targetMismatch).toBe(true);
  });

  it('does not flag a mismatch when a grant matches the address target', async () => {
    const { service } = build([
      row({
        email: 'svc-monitoring--logging-microservice@internal.alfares.cz',
        appName: 'logging-microservice',
      }),
    ]);

    const [record] = await service.listServicePrincipals();
    expect(record.targetMismatch).toBe(false);
  });

  it('groups several grants under one principal', async () => {
    const { service } = build([
      row({ id: 'u9', email: 'orders-status-cleanup@internal.invalid', roleName: 'action-admin', appName: 'orders-microservice' }),
      row({ id: 'u9', email: 'orders-status-cleanup@internal.invalid', roleName: 'admin', appName: 'orders-microservice' }),
    ]);

    const result = await service.listServicePrincipals();

    expect(result).toHaveLength(1);
    expect(result[0].grants).toHaveLength(2);
  });

  it('keeps a principal that holds no role at all, with no phantom grant', async () => {
    // A provisioned-but-never-granted principal is a real state and one worth
    // seeing; an inner join would have deleted this row entirely.
    const { service } = build([
      row({ id: 'u4', email: 'ungranted@internal.invalid', roleName: null, roleScope: null, appName: null }),
    ]);

    const [record] = await service.listServicePrincipals();

    expect(record.email).toBe('ungranted@internal.invalid');
    expect(record.grants).toEqual([]);
    // No grant means no target to compare against, so this is not a mismatch —
    // it is unprobeable, which the consumer reports separately.
    expect(record.targetMismatch).toBe(false);
  });

  it('keeps a grant whose application is null rather than dropping it', async () => {
    const { service } = build([
      row({ id: 'u5', email: 'global-role@internal.invalid', roleScope: 'global', appName: null }),
    ]);

    const [record] = await service.listServicePrincipals();
    expect(record.grants).toHaveLength(1);
    expect(record.grants[0].application).toBeNull();
  });

  it('excludes inactive principals by default and includes them on request', async () => {
    const { service, query } = build([row()]);

    await service.listServicePrincipals();
    expect(query.andWhere).toHaveBeenCalledWith('user.isActive = true');

    query.andWhere.mockClear();
    await service.listServicePrincipals(true);
    expect(query.andWhere).not.toHaveBeenCalled();
  });
});
