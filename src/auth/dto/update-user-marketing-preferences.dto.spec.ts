import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserMarketingPreferencesDto } from './update-user-marketing-preferences.dto';

describe('UpdateUserMarketingPreferencesDto', () => {
  it('accepts valid ISO8601 unsubscribedAt', async () => {
    const dto = plainToInstance(UpdateUserMarketingPreferencesDto, {
      unsubscribedAt: '2026-05-05T08:00:00.000Z',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid unsubscribedAt', async () => {
    const dto = plainToInstance(UpdateUserMarketingPreferencesDto, {
      unsubscribedAt: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
