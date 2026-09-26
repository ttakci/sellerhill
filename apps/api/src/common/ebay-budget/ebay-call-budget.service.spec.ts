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

const minuteWindow = { limit: 100, remaining: 100, timeWindowSeconds: 60, resetAt: null };
const inventoryWithMinute = {
  apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resourceName: 'sell.inventory',
  windows: [{ limit: 2_000_000, remaining: 2_000_000, timeWindowSeconds: 86_400, resetAt: null }, minuteWindow],
};

function setup(resources: Array<typeof taxonomy> | null, scriptResult: [number, number] = [1, 0]) {
  const runScript = jest.fn((_name: string, _keys: string[], _args: Array<string | number>) =>
    Promise.resolve<[number, number]>(scriptResult)
  );
  const redis = { registerScript: jest.fn(), runScript, keys: { key: (...p: Array<string | number>) => p.join(':') }, command: { get: jest.fn(() => Promise.resolve('7')), decrby: jest.fn() } };
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
  return { service, runScript, redis };
}

describe('EbayCallBudgetService.acquire', () => {
  it('sends every window in one script call: cost, then limit+ttl per key', async () => {
    const { service, runScript } = setup([inventoryWithMinute], [1, 0]);
    await service.acquire(EbayApiResource.INVENTORY, EbayCallPriority.BACKGROUND);
    const [, keys, args] = runScript.mock.calls[0];
    expect(keys).toHaveLength(2);
    expect(args[0]).toBe(1); // cost
    expect(args[1]).toBe(1_600_000); // daily, background (20% reserve)
    expect(args[3]).toBe(80); // 60s window, background
  });

  it('counts but never refuses a resource eBay has never reported: one daily key at -1', async () => {
    const { service, runScript } = setup(null, [1, 0]);
    await service.acquire(EbayApiResource.TRADING_END_ITEM);
    const [, keys, args] = runScript.mock.calls[0];
    expect(keys).toHaveLength(1);
    expect(args[1]).toBe(-1);
  });

  it('throws with the failing window’s reset and length', async () => {
    const { service } = setup([inventoryWithMinute], [0, 2]);
    const error = await service.acquire(EbayApiResource.INVENTORY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EbayBudgetExhaustedError);
    expect((error as EbayBudgetExhaustedError).windowSeconds).toBe(60);
    expect((error as EbayBudgetExhaustedError).resetAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
  });

  it('fails open when Redis throws', async () => {
    const { service, runScript } = setup([inventoryWithMinute], [1, 0]);
    runScript.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.acquire(EbayApiResource.INVENTORY)).resolves.toBeUndefined();
  });

  it('a refusal at index 1 (the daily window) throws EbayBudgetExhaustedError with an 86,400s window resetting at the next UTC midnight', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-09T13:45:00.000Z'));
    try {
      const { service } = setup([inventoryWithMinute], [0, 1]);
      const error = await service.acquire(EbayApiResource.INVENTORY).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EbayBudgetExhaustedError);
      expect((error as EbayBudgetExhaustedError).windowSeconds).toBe(86_400);
      expect((error as EbayBudgetExhaustedError).resetAt.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
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
