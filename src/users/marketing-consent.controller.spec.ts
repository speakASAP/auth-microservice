import { BadRequestException } from '@nestjs/common';
import { MarketingConsentController } from './marketing-consent.controller';

describe('MarketingConsentController', () => {
  let controller: MarketingConsentController;
  let consents: any;
  let tokens: any;

  beforeEach(() => {
    consents = {
      getLive: jest.fn(async () => [
        { product: 'speakasap', documentVersion: '2026-07-19' },
      ]),
      grant: jest.fn(async () => ({ id: 'c1' })),
      revoke: jest.fn(async () => undefined),
    };
    tokens = { verify: jest.fn(() => ({ userId: 'u1', product: 'marathon' })) };
    controller = new MarketingConsentController(consents, tokens);
  });

  it('returns live consent state and versions', async () => {
    const result = await controller.list({ user: { id: 'u1' } } as any);
    expect(result.consents).toEqual({ speakasap: true, marathon: false, bazos: false });
    expect(result.versions.speakasap).toBe('2026-07-19');
  });

  it('rejects an unknown product on grant', async () => {
    await expect(
      // Was 'bazos' until bazos became a real product. The rule under test is "reject anything
      // not in MARKETING_PRODUCTS", so the example has to be something genuinely absent from it.
      controller.grant({ user: { id: 'u1' } } as any, { product: 'not-a-product', documentVersion: 'v1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a documentVersion on grant', async () => {
    await expect(
      controller.grant({ user: { id: 'u1' } } as any, { product: 'marathon' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grants for the authenticated user only, ignoring any body userId', async () => {
    await controller.grant(
      { user: { id: 'u1' }, ip: '1.2.3.4', headers: {} } as any,
      { product: 'marathon', documentVersion: '2026-07-19', userId: 'attacker' } as any,
    );
    expect(consents.grant).toHaveBeenCalledWith('u1', 'marathon', '2026-07-19', '1.2.3.4', null);
  });

  it('revokes via a valid token without authentication', async () => {
    const result = await controller.unsubscribe({ token: 'good' });
    expect(consents.revoke).toHaveBeenCalledWith('u1', 'marathon');
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid unsubscribe token', async () => {
    tokens.verify = jest.fn(() => null);
    await expect(controller.unsubscribe({ token: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    expect(consents.revoke).not.toHaveBeenCalled();
  });
});
