import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { ServicePrincipalsService } from './service-principals.service';

/**
 * Generates the inventory query's REAL SQL against real entity metadata.
 *
 * The mocked-query-builder tests in `service-principals.service.spec.ts` cover
 * the grouping and mismatch logic, but they stub the builder entirely, so they
 * pass no matter what SQL it would emit. That gap shipped a `500` to production:
 * `.select([...])` parses its entries as entity property paths, so
 * `'user.id AS id'` and `'user."isActive" AS "isActive"'` produced
 * `syntax error at or near "."` — invalid SQL that no unit test could see.
 *
 * A DataSource builds metadata and renders SQL without ever connecting, so this
 * catches malformed query construction with no database and no fixtures.
 */
describe('ServicePrincipalsService SQL', () => {
  let dataSource: DataSource;
  let originalCreateQueryBuilder: any;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      entities: [User],
      synchronize: false,
    });
    // Protected, but it is the only way to render SQL without a live
    // connection — which is the whole point of this suite.
    await (dataSource as any).buildMetadatas();
    originalCreateQueryBuilder = dataSource.getRepository(User).createQueryBuilder;
  });

  /**
   * Renders the SQL the service would execute.
   *
   * `getRepository` returns a cached instance, so the real builder factory is
   * captured once here; re-spying on an already-spied method would wrap itself
   * and recurse.
   */
  const sqlFor = async (includeInactive: boolean): Promise<string> => {
    const repo = dataSource.getRepository(User);
    const makeBuilder = originalCreateQueryBuilder;
    let captured = '';

    const repoStub = {
      createQueryBuilder: (alias?: any) => {
        const qb = makeBuilder.call(repo, alias);
        // Intercept execution: the real builder still renders SQL, but nothing
        // tries to run it against a connection that does not exist.
        (qb as any).getRawMany = async () => {
          captured = qb.getSql();
          return [];
        };
        return qb;
      },
    };

    const service = new ServicePrincipalsService(repoStub as any);
    await service.listServicePrincipals(includeInactive);
    return captured;
  };

  it('never emits an unquoted alias before a quoted column', async () => {
    const sql = await sqlFor(false);

    // The exact production failure. `.select(['user."isActive" AS "isActive"'])`
    // rendered `user."isActive"` with the alias UNQUOTED, so Postgres parsed
    // `user` as the reserved keyword USER and returned
    // `syntax error at or near "."`. The correct form is `"user"."isActive"`.
    expect(sql).not.toMatch(/(^|[\s,(])user\."/);
  });

  it('renders every selected column as a quoted alias-qualified identifier', async () => {
    const sql = await sqlFor(false);

    expect(sql).toContain('FROM "users"');
    expect(sql).toMatch(/"user"\."id"/);
    expect(sql).toMatch(/"user"\."email"/);
    expect(sql).toMatch(/"user"\."isActive"/);
    expect(sql).toMatch(/"ur"\."expiresAt"/);
  });

  it('joins roles and applications with LEFT JOIN, never INNER', async () => {
    const sql = await sqlFor(false);

    // user_roles.applicationId is nullable for global roles; an inner join would
    // drop exactly the principals worth inspecting.
    expect(sql).toContain('LEFT JOIN "user_roles"');
    expect(sql).toContain('LEFT JOIN "roles"');
    expect(sql).toContain('LEFT JOIN "applications"');
    expect(sql).not.toContain('INNER JOIN');
  });

  it('filters on userType, never on the address convention', async () => {
    const sql = await sqlFor(false);

    expect(sql).toMatch(/"user"\."userType"\s*=/);
    // Filtering by address would silently drop the off-convention principals.
    expect(sql).not.toContain('internal.alfares.cz');
    expect(sql).not.toMatch(/LIKE/i);
  });

  it('restricts to active principals unless inactive are requested', async () => {
    const activeOnly = await sqlFor(false);
    const all = await sqlFor(true);

    expect(activeOnly).toMatch(/"user"\."isActive"\s*=\s*true/);
    expect(all).not.toMatch(/"user"\."isActive"\s*=\s*true/);
  });
});
