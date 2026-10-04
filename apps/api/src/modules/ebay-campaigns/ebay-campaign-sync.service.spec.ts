import { EbayCallPriority } from '@repo/shared';

import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';

import { CampaignAdStateRepository } from './campaign-ad-state.repository';
import { EbayCampaignSyncService } from './ebay-campaign-sync.service';
import { CAMPAIGN_MAX_PAGES, CAMPAIGN_PAGE_LIMIT } from './ebay-campaigns.constants';

const account = { id: 'store-1', user_id: 'seller-1' };
const campaign = (id = 'c1', status = 'RUNNING', fundingModel = 'COST_PER_SALE') => ({
  campaignId: id,
  campaignName: id,
  campaignStatus: status,
  fundingStrategy: { fundingModel, adRateStrategy: 'FIXED', bidPercentage: '5.5' },
});
const page = (...campaigns: ReturnType<typeof campaign>[]) => ({ campaigns, total: campaigns.length });
const ads = (listingId = '1', bidPercentage = '5.5') => ({ ads: [{ listingId, bidPercentage }], total: 1 });

function setup() {
  let campaignStatus = 'RUNNING';
  const db = {
    query: jest.fn((sql: string, _params?: unknown[]) => {
      if (sql.includes('WITH due')) {
        return [account];
      }
      if (sql.includes('SELECT ebay_item_id')) {
        return [{ ebay_item_id: '1' }, { ebay_item_id: '2' }];
      }
      if (sql.includes('SELECT campaign_id')) {
        return [
          { campaign_id: 'c1', status: campaignStatus, funding_model: 'COST_PER_SALE', ad_rate_strategy: 'FIXED' },
          { campaign_id: 'c2', status: 'PAUSED', funding_model: 'COST_PER_SALE', ad_rate_strategy: 'FIXED' },
        ] as never;
      }
      if (sql.includes('INSERT INTO ebay_campaigns')) {
        campaignStatus = (JSON.parse(String(_params?.[1])) as Array<{ status: string }>)[0].status;
      }
      if (sql.includes('UPDATE listings')) {
        return [{ product_id: 'p1', changed: true }];
      }
      return [];
    }),
  };
  const settings = { getBoolean: jest.fn().mockResolvedValue(true), getNumber: jest.fn().mockResolvedValue(6) };
  const quota = { isSuspended: jest.fn().mockResolvedValue(false) };
  const ebay = { getAccountApiContext: jest.fn().mockResolvedValue({ accessToken: 'test', marketplaceId: 'EBAY_US' }) };
  const client = {
    getCampaigns: jest.fn().mockResolvedValue(page(campaign())),
    getAds: jest.fn().mockResolvedValue(ads()),
  };
  const stock = { enqueueProductStockSync: jest.fn().mockResolvedValue(undefined) };
  const repository = new CampaignAdStateRepository(db as never);
  const service = new EbayCampaignSyncService(
    db as never,
    settings as never,
    quota as never,
    ebay as never,
    client as never,
    repository,
    stock as never
  );
  const queries = () => db.query.mock.calls.map(([sql, params]) => ({ sql, params }));
  const writes = () => queries().filter(({ sql }) => sql.includes('UPDATE listings'));
  const deletes = () => queries().filter(({ sql }) => sql.includes('DELETE FROM ebay_campaigns'));
  return { db, settings, quota, ebay, client, stock, service, queries, writes, deletes };
}

describe('campaign sweep using the real ad-state repository', () => {
  it('switched off performs no database or eBay call', async () => {
    const f = setup();
    f.settings.getBoolean.mockResolvedValue(false);
    await f.service.runSweep();
    expect(f.db.query).not.toHaveBeenCalled();
    expect(f.ebay.getAccountApiContext).not.toHaveBeenCalled();
  });
  it('claims active due stores atomically and reads them at background priority', async () => {
    const f = setup();
    await f.service.runSweep();
    const claim = f.queries()[0];
    expect(claim.sql).toContain('last_campaign_sync_at');
    expect(claim.sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(claim.sql).toContain("status = 'active'");
    expect(claim.sql).toContain('NULLS FIRST');
    expect(claim.params).toEqual(['6', 6]);
    expect(f.client.getCampaigns).toHaveBeenCalledWith(expect.anything(), 0, EbayCallPriority.BACKGROUND);
  });
  it('skips suspended owners', async () => {
    const f = setup();
    f.quota.isSuspended.mockResolvedValue(true);
    await f.service.runSweep();
    expect(f.ebay.getAccountApiContext).not.toHaveBeenCalled();
  });
  it('complete sweep persists per-ad rates, paused zero, metadata and the clear predicate', async () => {
    const f = setup();
    f.client.getCampaigns.mockResolvedValue(page(campaign(), campaign('c2', 'PAUSED')));
    f.client.getAds.mockImplementation((_ctx: unknown, id: string, params: { listingIds?: string[] }) =>
      params.listingIds ? ads(id === 'c1' ? '1' : '2', id === 'c1' ? '5.5' : '7.0') : ads()
    );
    expect(await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).toEqual({
      campaigns: 2,
      complete: true,
      repricedProducts: 1,
    });
    const set = f.writes().find(({ sql }) => sql.includes('unnest'))!;
    expect(set.params).toEqual(['store-1', ['1', '2'], ['c1', 'c2'], [5.5, 7], ['FIXED', 'FIXED'], [5.5, 0]]);
    expect(set.sql).toContain('old.ad_rate_applied IS DISTINCT FROM v.applied');
    expect(set.sql).toContain('l.ebay_account_id = $1');
    expect(f.writes().some(({ sql }) => sql.includes('<> ALL'))).toBe(true);
    expect(f.deletes()).toHaveLength(1);
  });
  it('deduplicates changed products and does not enqueue unchanged products', async () => {
    const f = setup();
    f.db.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT ebay_item_id')) {
        return [{ ebay_item_id: '1' }];
      }
      if (sql.includes('SELECT campaign_id')) {
        return [
          { campaign_id: 'c1', status: 'RUNNING', funding_model: 'COST_PER_SALE', ad_rate_strategy: 'FIXED' },
        ] as never;
      }
      if (sql.includes('UPDATE listings')) {
        return [
          { product_id: 'p1', changed: true },
          { product_id: 'p1', changed: true },
          { product_id: 'p2', changed: false },
        ] as never;
      }
      return [];
    });
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([['p1']]);
  });
  it.each(['PAUSED', 'ENDED'])(
    '%s complete sweep reduces applied rates to zero and enqueues repricing',
    async (status) => {
      const f = setup();
      f.client.getCampaigns.mockResolvedValue(page(campaign('c1', status)));
      await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
      if (status === 'PAUSED') {
        expect(f.writes().find(({ sql }) => sql.includes('unnest'))!.params?.[5]).toEqual([0]);
      } else {
        expect(f.writes()).toHaveLength(1);
      }
      const clear = f.writes().find(({ sql }) => sql.includes('<> ALL'))!;
      expect(clear.sql).toContain('ad_rate_applied = 0');
      expect(clear.sql).toContain('old.ad_rate_applied > 0');
      expect(f.stock.enqueueProductStockSync).toHaveBeenCalledWith('p1');
    }
  );
  it('one failed ad read preserves every listing even after a successful paused read', async () => {
    const f = setup();
    f.client.getCampaigns.mockResolvedValue(page(campaign('c1', 'PAUSED'), campaign('c2')));
    f.client.getAds.mockImplementation((_ctx: unknown, id: string) => {
      if (id === 'c2') {
        throw new Error('429');
      }
      return ads();
    });
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
    expect(f.stock.enqueueProductStockSync).not.toHaveBeenCalled();
    expect(f.queries().some(({ sql }) => sql.includes('INSERT INTO ebay_campaigns'))).toBe(true);
  });
  it('failed campaign read writes no listing state', async () => {
    const f = setup();
    f.client.getCampaigns.mockRejectedValue(new Error('503'));
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
  });
  it.each([{}, { total: 1, campaigns: [null] }, { total: 2, campaigns: [campaign()] }])(
    'undocumented, malformed or truncated campaign page fails closed: %j',
    async (body) => {
      const f = setup();
      f.client.getCampaigns.mockResolvedValue(body);
      expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
      expect(f.writes()).toEqual([]);
      expect(f.deletes()).toEqual([]);
    }
  );
  it('changing totals between campaign pages fails closed while retaining metadata', async () => {
    const f = setup();
    const first = Array.from({ length: 500 }, (_, i) => campaign(`c${i}`));
    f.client.getCampaigns
      .mockResolvedValueOnce({ campaigns: first, total: 501 })
      .mockResolvedValueOnce({ campaigns: [campaign('last')], total: 502 });
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
  });
  it('page cap without exhaustion proof fails closed', async () => {
    const f = setup();
    f.client.getCampaigns.mockImplementation((_ctx: unknown, offset: number) => ({
      total: (CAMPAIGN_MAX_PAGES + 1) * CAMPAIGN_PAGE_LIMIT,
      campaigns: Array.from({ length: CAMPAIGN_PAGE_LIMIT }, (_, i) => campaign(`c${offset + i}`)),
    }));
    const result = await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(result.complete).toBe(false);
    expect(f.client.getCampaigns).toHaveBeenCalledTimes(CAMPAIGN_MAX_PAGES);
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
  });
  it.each([{}, { total: 1, ads: [null] }, { total: 2, ads: [{ listingId: '1', bidPercentage: '5.5' }] }])(
    'invalid listing-id ads fail closed: %j',
    async (body) => {
      const f = setup();
      f.client.getAds.mockImplementation((_ctx: unknown, _id: string, params: { listingIds?: string[] }) =>
        params.listingIds ? body : ads()
      );
      expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
      expect(f.writes()).toEqual([]);
    }
  );
  it('undocumented ad count prevents all listing state writes', async () => {
    const f = setup();
    f.client.getAds.mockResolvedValueOnce({});
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
  });
  it('failed ad-count read preserves state even when listing-id reads succeed', async () => {
    const f = setup();
    f.client.getAds.mockRejectedValueOnce(new Error('count unavailable'));
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
    expect(f.client.getAds).toHaveBeenCalledTimes(2);
  });
  it('ad-count total contradicting the listing-id coverage preserves every listing', async () => {
    const f = setup();
    f.client.getAds.mockResolvedValueOnce({ total: 0, ads: [] }).mockResolvedValueOnce(ads());
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
  });
  it('a later failed campaign page upserts the first page without deleting or writing listings', async () => {
    const f = setup();
    const campaigns = Array.from({ length: 500 }, (_, i) => campaign(`c${i}`));
    f.client.getCampaigns
      .mockResolvedValueOnce({ campaigns, total: 501 })
      .mockRejectedValueOnce(new Error('page 2 failed'));
    expect(await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).toEqual({
      campaigns: 500,
      complete: false,
      repricedProducts: 0,
    });
    expect(f.writes()).toEqual([]);
    expect(f.deletes()).toEqual([]);
    const upsert = f.queries().find(({ sql }) => sql.includes('INSERT INTO ebay_campaigns'))!;
    expect(JSON.parse(String(upsert.params?.[1])) as unknown[]).toHaveLength(500);
  });
  it('valid empty campaign coverage clears stale listings and removes stale campaign metadata', async () => {
    const f = setup();
    f.client.getCampaigns.mockResolvedValue(page());
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(true);
    expect(f.deletes()[0].params).toEqual(['store-1', []]);
    expect(f.writes()[0].params).toEqual(['store-1', []]);
  });
  it('campaign pagination uses 500 offsets and requires exact exhaustion', async () => {
    const f = setup();
    const campaigns = Array.from({ length: 500 }, (_, i) => campaign(`c${i}`, 'ENDED'));
    f.client.getCampaigns
      .mockResolvedValueOnce({ campaigns, total: 501 })
      .mockResolvedValueOnce({ campaigns: [campaign('last', 'ENDED')], total: 501 });
    f.client.getAds.mockResolvedValue({ total: 0, ads: [] });
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(true);
    expect(f.client.getCampaigns.mock.calls.map((c: unknown[]) => c[1])).toEqual([0, 500]);
  });
  it('listing ids are deduplicated and chunked at 500', async () => {
    const f = setup();
    f.db.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT ebay_item_id')) {
        return [...Array.from({ length: 501 }, (_, i) => ({ ebay_item_id: String(i) })), { ebay_item_id: '1' }];
      }
      return [];
    });
    f.client.getAds.mockResolvedValue({ total: 0, ads: [] });
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(true);
    expect(
      f.client.getAds.mock.calls.map((c: unknown[]) => (c[2] as { listingIds?: string[] }).listingIds?.length)
    ).toEqual([undefined, 500, 1]);
  });
  it('conflicting campaigns for a listing preserve its existing state', async () => {
    const f = setup();
    f.client.getCampaigns.mockResolvedValue(page(campaign(), campaign('c2')));
    expect((await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).complete).toBe(false);
    expect(f.writes()).toEqual([]);
  });
  it('rule-based and CPC campaigns have no listing-id calls', async () => {
    const f = setup();
    f.client.getCampaigns.mockResolvedValue({
      total: 2,
      campaigns: [{ ...campaign(), campaignCriterion: {} }, campaign('c2', 'RUNNING', 'COST_PER_CLICK')],
    });
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(
      f.client.getAds.mock.calls.every((call: unknown[]) => !(call[2] as { listingIds?: string[] }).listingIds)
    ).toBe(true);
  });
  it.each([undefined, null])(
    'nullish strategy uses FIXED and omitted ad bid falls back to campaign: %s',
    async (strategy) => {
      const f = setup();
      const c = campaign();
      c.fundingStrategy.adRateStrategy = strategy as never;
      f.client.getCampaigns.mockResolvedValue(page(c));
      f.client.getAds.mockResolvedValue({ total: 1, ads: [{ listingId: '1' }] });
      await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
      expect(f.writes().find(({ sql }) => sql.includes('unnest'))!.params?.[5]).toEqual([5.5]);
    }
  );
  it('budget exhaustion in an ads read stops before the next store', async () => {
    const f = setup();
    f.db.query.mockImplementation((sql: string) =>
      sql.includes('WITH due') ? [account, { id: 'store-2', user_id: 'seller-2' }] : []
    );
    f.client.getAds.mockRejectedValue(new EbayBudgetExhaustedError('marketing', new Date()));
    await f.service.runSweep();
    expect(f.ebay.getAccountApiContext.mock.calls).toEqual([['store-1']]);
  });
  it('ordinary store error continues to the next store', async () => {
    const f = setup();
    f.db.query.mockImplementation((sql: string) =>
      sql.includes('WITH due') ? [account, { id: 'store-2', user_id: 'seller-2' }] : []
    );
    f.ebay.getAccountApiContext.mockRejectedValueOnce(new Error('token'));
    await f.service.runSweep();
    expect(f.ebay.getAccountApiContext.mock.calls).toEqual([['store-1'], ['store-2']]);
  });
});
