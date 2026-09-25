import { EbayApiResource, EbayCallPriority, PlatformSettingKey } from '@repo/shared';

import type { RedisService } from '../redis/redis.service';
import type { PlatformSettingsService } from '../settings/platform-settings.service';

import { EbayBudgetExhaustedError } from './ebay-budget.errors';
import { EbayCallBudgetService } from './ebay-call-budget.service';
import type { EbayRateLimitStore } from './ebay-rate-limit.store';
import { mapRateLimits } from './ebay-rate-limits';

const taxonomy = {
  apiContext: 'commerce', apiName: 'Taxonomy', apiVersion: 'v1', resourceName: 'commerce.taxonomy',
  windows: [{ limit: 5_000, remaining: 5_000, timeWindowSeconds: 86_400, resetAt: null }],
};

function setup(resources: typeof taxonomy[] | null, scriptResult: [number, number] = [1, 10]) {
  const runScript = jest.fn((_name: string, _keys: string[], _args: Array<string | number>) =>
    Promise.resolve<[number, number]>(scriptResult)
  );
  const redis = { registerScript: jest.fn(), runScript, keys: { key: (...p: string[]) => p.join(':') }, command: { get: jest.fn(() => Promise.resolve('7')), decrby: jest.fn() } };
  const settings = {
    getBoolean: jest.fn(() => Promise.resolve(true)),
    getNumber: jest.fn((k: PlatformSettingKey) => Promise.resolve(k === PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT ? 20 : 0)),
  };
  const store = {
    current: jest.fn(() =>
      Promise.resolve(resources ? { resources, fetchedAt: new Date(), mapped: mapRateLimits(resources) } : null)
    ),
  };
  const service = new EbayCallBudgetService(
    redis as unknown as RedisService,
    settings as unknown as PlatformSettingsService,
    store as unknown as EbayRateLimitStore,
  );
  return { service, runScript };
}

describe('EbayCallBudgetService.acquire', () => {
  it('gates against eBay\'s ceiling minus the reserve for background work', async () => {
    const { service, runScript } = setup([taxonomy]);
    await service.acquire(EbayApiResource.TAXONOMY, EbayCallPriority.BACKGROUND);
    expect(runScript.mock.calls[0][2][0]).toBe(4_000);
  });

  it('counts but never refuses when eBay has never reported limits', async () => {
    const { service, runScript } = setup(null);
    await service.acquire(EbayApiResource.TAXONOMY);
    // -1 = unlimited in the Lua script: still INCRBY, never a refusal.
    expect(runScript.mock.calls[0][2][0]).toBe(-1);
  });

  it('counts but never refuses a resource eBay stopped reporting', async () => {
    const { service, runScript } = setup([taxonomy]);
    await service.acquire(EbayApiResource.INVENTORY);
    expect(runScript.mock.calls[0][2][0]).toBe(-1);
  });

  it('throws EbayBudgetExhaustedError when the script refuses', async () => {
    const { service } = setup([taxonomy], [0, 0]);
    await expect(service.acquire(EbayApiResource.TAXONOMY)).rejects.toBeInstanceOf(EbayBudgetExhaustedError);
  });
});

describe('EbayCallBudgetService.countsToday', () => {
  it('returns our counter for every resource', async () => {
    const { service } = setup([taxonomy]);
    const counts = await service.countsToday();
    expect(Object.keys(counts).sort()).toEqual(Object.values(EbayApiResource).sort());
    expect(counts[EbayApiResource.TAXONOMY]).toBe(7);
  });
});
