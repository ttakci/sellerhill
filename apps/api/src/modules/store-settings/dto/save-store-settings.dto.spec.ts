import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SaveStoreSettingsDto } from './save-store-settings.dto';

// The app's ValidationPipe runs with `whitelist` AND `forbidNonWhitelisted`, so
// a field the DTO no longer declares is a 400 — not silently dropped.
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

const check = async (body: Record<string, unknown>) =>
  validate(plainToInstance(SaveStoreSettingsDto, body), PIPE_OPTIONS);

describe('SaveStoreSettingsDto', () => {
  it('accepts an old client that still sends listingRules (the rules moved to the settings group)', async () => {
    const errors = await check({ isGlobal: true, amazonTaxRate: 0, listingRules: { minRating: 4 } });
    expect(errors).toEqual([]);
  });

  it('accepts a blocked-ASIN list, null (inherit) or nothing', async () => {
    expect(await check({ isGlobal: false, storeId: 'store-1', amazonTaxRate: 0, blockedAsins: ['B0AAAAAAAA'] })).toEqual([]);
    expect(await check({ isGlobal: false, storeId: 'store-1', amazonTaxRate: 0, blockedAsins: null })).toEqual([]);
    expect(await check({ isGlobal: true, amazonTaxRate: 0 })).toEqual([]);
  });

  it('still refuses a field it never knew', async () => {
    const errors = await check({ isGlobal: true, amazonTaxRate: 0, somethingElse: 1 });
    expect(errors.length).toBeGreaterThan(0);
  });
});
