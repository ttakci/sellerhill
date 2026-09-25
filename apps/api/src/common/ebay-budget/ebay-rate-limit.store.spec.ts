import { EbayApiResource, type EbayRateLimitResourceDto } from '@repo/shared';

import type { DatabaseService } from '../database/database.service';

import { EbayRateLimitStore, STORE_MEMORY_TTL_MS } from './ebay-rate-limit.store';

const inventory: EbayRateLimitResourceDto = {
  apiContext: 'sell',
  apiName: 'Inventory',
  apiVersion: 'v1',
  resourceName: 'sell.inventory',
  windows: [{ limit: 2_000_000, remaining: 2_000_000, timeWindowSeconds: 86_400, resetAt: null }],
};

function fakeDb(rows: Array<{ resources: unknown; fetched_at: Date }> = []) {
  const query = jest.fn((sql: string) => Promise.resolve(sql.trim().startsWith('SELECT') ? rows : []));
  return { db: { query } as unknown as DatabaseService, query };
}

describe('EbayRateLimitStore', () => {
  afterEach(() => jest.useRealTimers());

  it('returns null when eBay has never answered', async () => {
    const { db } = fakeDb();
    expect(await new EbayRateLimitStore(db).current()).toBeNull();
  });

  it('reads and maps the stored snapshot', async () => {
    const fetchedAt = new Date('2026-09-25T10:00:00Z');
    const { db } = fakeDb([{ resources: [inventory], fetched_at: fetchedAt }]);
    const snapshot = await new EbayRateLimitStore(db).current();
    expect(snapshot?.fetchedAt).toEqual(fetchedAt);
    expect(snapshot?.mapped.byResource[EbayApiResource.INVENTORY]?.limit).toBe(2_000_000);
  });

  it('upserts the single row on save and serves it from memory afterwards', async () => {
    const { db, query } = fakeDb();
    const store = new EbayRateLimitStore(db);
    await store.save([inventory], new Date('2026-09-25T10:00:00Z'));
    const upsert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO ebay_rate_limits'));
    expect(upsert?.[0]).toContain('ON CONFLICT (id) DO UPDATE');
    query.mockClear();
    expect((await store.current())?.resources).toEqual([inventory]);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses to store an empty list — that would ungate every resource', async () => {
    const { db, query } = fakeDb();
    await new EbayRateLimitStore(db).save([], new Date());
    expect(query).not.toHaveBeenCalled();
  });

  it('re-reads the database once its memory is older than the TTL (another replica refreshed)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const rows = [{ resources: [inventory], fetched_at: new Date('2026-09-25T09:00:00Z') }];
    const { db, query } = fakeDb(rows);
    const store = new EbayRateLimitStore(db);
    await store.current();
    await store.current();
    expect(query).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date(Date.now() + STORE_MEMORY_TTL_MS + 1));
    await store.current();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('keeps the last value it had when the database read fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const { db, query } = fakeDb([{ resources: [inventory], fetched_at: new Date() }]);
    const store = new EbayRateLimitStore(db);
    await store.current();
    query.mockRejectedValueOnce(new Error('db down'));
    jest.setSystemTime(new Date(Date.now() + STORE_MEMORY_TTL_MS + 1));
    expect((await store.current())?.resources).toEqual([inventory]);
  });
});
