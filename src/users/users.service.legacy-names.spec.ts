import { UsersService } from './users.service';

/**
 * Regression tests for `findNamesByLegacyIds`.
 *
 * The first version built its projection with the array form of TypeORM's
 * `select()`:
 *
 *   .select(['mapping."legacyUserId" AS "legacyUserId"', ...])
 *
 * That form takes **column identifiers**, not raw SQL — TypeORM escapes each
 * entry, so the `AS` aliases produced invalid SQL and every call failed with
 * `syntax error at or near "."` (500). It shipped because nothing exercised the
 * method: the controller spec mocks the service, so the query was never built.
 *
 * These tests assert on the built query rather than mocking it away, so a
 * projection that cannot execute fails here instead of in production.
 */

type QueryBuilderSpy = {
  innerJoin: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getRawMany: jest.Mock;
};

function makeService(rows: unknown[] = []) {
  const qb: QueryBuilderSpy = {
    innerJoin: jest.fn(() => qb),
    select: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getRawMany: jest.fn(async () => rows),
  };

  // legacyIdentityMappingRepository is the fourth constructor argument.
  const legacyRepo = { createQueryBuilder: jest.fn(() => qb) };
  const service = new UsersService(
    {} as never,
    {} as never,
    {} as never,
    legacyRepo as never,
  );
  return { service, qb };
}

/** Every projection expression handed to select/addSelect, in order. */
function projections(qb: QueryBuilderSpy): string[] {
  const out: string[] = [];
  for (const call of qb.select.mock.calls) {
    const arg = call[0];
    if (Array.isArray(arg)) out.push(...arg);
    else if (typeof arg === 'string') out.push(arg);
  }
  for (const call of qb.addSelect.mock.calls) {
    if (typeof call[0] === 'string') out.push(call[0]);
  }
  return out;
}

describe('UsersService.findNamesByLegacyIds', () => {
  it('returns early without touching the database for an empty id list', async () => {
    const { service, qb } = makeService();
    await expect(service.findNamesByLegacyIds('speakasap-portal', [])).resolves.toEqual([]);
    expect(qb.getRawMany).not.toHaveBeenCalled();
  });

  // The defect: an aliased expression passed through the array form of select()
  // is escaped as an identifier and cannot execute.
  it('never passes aliased SQL to the array form of select()', async () => {
    const { service, qb } = makeService();
    await service.findNamesByLegacyIds('speakasap-portal', [58]);

    for (const call of qb.select.mock.calls) {
      if (Array.isArray(call[0])) {
        for (const entry of call[0]) {
          expect(String(entry)).not.toMatch(/\sAS\s/i);
        }
      }
    }
  });

  it('projects every field the response needs', async () => {
    const { service, qb } = makeService();
    await service.findNamesByLegacyIds('speakasap-portal', [58]);

    const all = projections(qb).join(' | ');
    expect(all).toMatch(/legacyUserId/);
    expect(all).toMatch(/firstName/);
    expect(all).toMatch(/lastName/);
    expect(all).toMatch(/email/);
  });

  it('scopes the lookup to one legacy system and the requested ids', async () => {
    const { service, qb } = makeService();
    await service.findNamesByLegacyIds('speakasap-portal', [58, 145]);

    expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('legacySystem'), {
      legacySystem: 'speakasap-portal',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('legacyUserId'), {
      legacyUserIds: [58, 145],
    });
  });

  it('joins first and last name', async () => {
    const { service } = makeService([
      { legacyUserId: 58, firstName: 'Anna', lastName: 'Ivanova', email: 'anna@example.com' },
    ]);
    const [row] = await service.findNamesByLegacyIds('speakasap-portal', [58]);
    expect(row).toEqual({ legacyUserId: 58, name: 'Anna Ivanova', email: 'anna@example.com' });
  });

  // A teacher recognises an email far better than "Student 58".
  it('falls back to the email local part when there is no name', async () => {
    const { service } = makeService([
      { legacyUserId: 58, firstName: null, lastName: null, email: 'anna.ivanova@example.com' },
    ]);
    const [row] = await service.findNamesByLegacyIds('speakasap-portal', [58]);
    expect(row.name).toBe('anna.ivanova');
  });

  it('leaves the name empty rather than inventing a placeholder', async () => {
    const { service } = makeService([
      { legacyUserId: 58, firstName: null, lastName: null, email: null },
    ]);
    const [row] = await service.findNamesByLegacyIds('speakasap-portal', [58]);
    expect(row.name).toBe('');
  });

  it('coerces a string legacyUserId back to a number', async () => {
    const { service } = makeService([
      { legacyUserId: '58', firstName: 'Anna', lastName: null, email: null },
    ]);
    const [row] = await service.findNamesByLegacyIds('speakasap-portal', [58]);
    expect(row.legacyUserId).toBe(58);
  });
});
