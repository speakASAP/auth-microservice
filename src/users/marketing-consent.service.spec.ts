import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarketingConsentService } from './marketing-consent.service';
import { UserMarketingConsent } from './entities/user-marketing-consent.entity';
import { User } from './entities/user.entity';

describe('MarketingConsentService', () => {
  let service: MarketingConsentService;
  let consentRepo: any;
  let userRepo: any;
  let rows: UserMarketingConsent[];

  beforeEach(async () => {
    rows = [];
    consentRepo = {
      find: jest.fn(async ({ where }: any) =>
        rows.filter(
          (r) =>
            r.userId === where.userId &&
            r.revokedAt === null &&
            (where.product ? r.product === where.product : true),
        ),
      ),
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (row: any) => {
        if (!row.id) {
          row.id = `row-${rows.length + 1}`;
          rows.push(row);
        }
        return row;
      }),
    };
    userRepo = { update: jest.fn(async () => ({ affected: 1 })) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketingConsentService,
        { provide: getRepositoryToken(UserMarketingConsent), useValue: consentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = moduleRef.get(MarketingConsentService);
  });

  it('grants consent and records the document version', async () => {
    const row = await service.grant('u1', 'speakasap', '2026-07-19', '1.2.3.4', 'UA');
    expect(row.product).toBe('speakasap');
    expect(row.documentVersion).toBe('2026-07-19');
    expect(row.revokedAt).toBeNull();
    expect(row.ip).toBe('1.2.3.4');
  });

  it('is idempotent when re-granting the same version', async () => {
    const first = await service.grant('u1', 'speakasap', '2026-07-19');
    const second = await service.grant('u1', 'speakasap', '2026-07-19');
    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it('revokes the old row and inserts a new one on a version change', async () => {
    await service.grant('u1', 'speakasap', '2026-07-19');
    await service.grant('u1', 'speakasap', '2026-09-01');
    expect(rows).toHaveLength(2);
    expect(rows[0].revokedAt).toBeInstanceOf(Date);
    expect(rows[1].revokedAt).toBeNull();
    expect(rows[1].documentVersion).toBe('2026-09-01');
  });

  it('stamps revokedAt on withdrawal instead of deleting', async () => {
    await service.grant('u1', 'speakasap', '2026-07-19');
    await service.revoke('u1', 'speakasap');
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeInstanceOf(Date);
  });

  it('projects live consent keyed by product (appId), defaulting others to false', async () => {
    await service.grant('u1', 'speakasap', '2026-07-19');
    expect(userRepo.update).toHaveBeenLastCalledWith('u1', {
      marketingConsents: { speakasap: true, marathon: false },
    });
  });

  it('never touches the global kill-switches on per-product withdrawal', async () => {
    await service.grant('u1', 'speakasap', '2026-07-19');
    await service.revoke('u1', 'speakasap');
    for (const call of userRepo.update.mock.calls) {
      expect(call[1]).not.toHaveProperty('unsubscribedAt');
      expect(call[1]).not.toHaveProperty('transactionalOnly');
    }
  });

  it('keeps products independent', async () => {
    await service.grant('u1', 'speakasap', '2026-07-19');
    await service.grant('u1', 'marathon', '2026-07-19');
    await service.revoke('u1', 'marathon');
    expect(userRepo.update).toHaveBeenLastCalledWith('u1', {
      marketingConsents: { speakasap: true, marathon: false },
    });
  });
});
