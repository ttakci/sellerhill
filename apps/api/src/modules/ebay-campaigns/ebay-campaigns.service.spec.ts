import { EbayCampaignsService } from './ebay-campaigns.service';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function fixture() {
  const database = {
    query: jest.fn((sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM ebay_accounts')) {
        return [{ id: params[0] as string, user_id: userId }];
      }
      if (sql.includes('FROM ebay_campaigns')) {
        return [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            ebay_account_id: accountId,
            campaign_id: '100',
            name: 'One',
            status: 'RUNNING',
            funding_model: 'COST_PER_SALE',
            ad_rate_strategy: 'FIXED',
            bid_percentage: '5.0',
            rule_based: false,
            created_by_sellerhill: true,
            start_date: null,
            end_date: null,
            ad_count: 1,
            seller_hill_listing_count: '1',
            synced_at: new Date(),
            metrics: null,
            metrics_from: null,
            metrics_to: null,
          },
        ];
      }
      if (sql.includes('COUNT(*) FILTER')) {
        return [{ total: '2', skipped: '3' }];
      }
      if (sql.includes('FROM listings l LEFT JOIN products')) {
        return [
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            ebay_item_id: '123',
            title: 'Shirt',
            image_url: null,
            price: '14.49',
            promoted_ad_rate: '5.5',
            ad_rate_applied: '5.5',
            lock_price: true,
          },
        ];
      }
      return [];
    }),
  };
  const eligibility = { getEligibility: jest.fn().mockResolvedValue({ status: 'ELIGIBLE', reason: null }) };
  const sync = { syncAccount: jest.fn().mockResolvedValue({ campaigns: 1, complete: true, repricedProducts: 0 }) };
  return {
    database,
    eligibility,
    sync,
    service: new EbayCampaignsService(database as never, eligibility as never, sync as never),
  };
}

describe('EbayCampaignsService', () => {
  it('scopes campaign reads to an owned store', async () => {
    const f = fixture();
    f.database.query.mockReturnValue([]);
    await expect(f.service.list(userId, accountId)).rejects.toMatchObject({ key: 'campaigns.errors.storeUnavailable' });
    expect(f.eligibility.getEligibility).not.toHaveBeenCalled();
  });

  it('counts candidates and in-campaign skipped items with the same filter', async () => {
    const f = fixture();
    const result = await f.service.candidates(userId, {
      ebayAccountId: accountId,
      search: 'shirt',
      page: 2,
      limit: 10,
    });
    expect(result).toMatchObject({ total: 2, skippedInCampaign: 3, page: 2, limit: 10 });
    const sqls = f.database.query.mock.calls.map((args) => args[0]);
    expect(sqls.filter((sql) => sql.includes('l.ebay_account_id = $2'))).toHaveLength(2);
    expect(sqls.filter((sql) => sql.includes('l.title ILIKE'))).toHaveLength(2);
  });

  it('coalesces concurrent interactive detail refreshes and caches for 60 seconds', async () => {
    const f = fixture();
    let release!: () => void;
    f.sync.syncAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ campaigns: 1, complete: true, repricedProducts: 0 });
        })
    );
    const first = f.service.detail(userId, accountId, '100');
    const second = f.service.detail(userId, accountId, '100');
    await new Promise((resolve) => setImmediate(resolve));
    expect(f.sync.syncAccount).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    await f.service.detail(userId, accountId, '100');
    expect(f.sync.syncAccount).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-flight refresh shared beyond 60 seconds and starts a new one after expiry', async () => {
    const f = fixture();
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    let release!: () => void;
    f.sync.syncAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ campaigns: 1, complete: true, repricedProducts: 0 });
        })
    );
    try {
      const first = f.service.detail(userId, accountId, '100');
      await new Promise((resolve) => setImmediate(resolve));
      now.mockReturnValue(1_060_001);
      const second = f.service.detail(userId, accountId, '100');
      await new Promise((resolve) => setImmediate(resolve));
      expect(f.sync.syncAccount).toHaveBeenCalledTimes(1);
      release();
      await Promise.all([first, second]);
      now.mockReturnValue(1_120_002);
      await f.service.detail(userId, accountId, '100');
      expect(f.sync.syncAccount).toHaveBeenCalledTimes(2);
      await f.service.detail(userId, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '100');
      expect(f.sync.syncAccount).toHaveBeenCalledTimes(3);
    } finally {
      now.mockRestore();
    }
  });

  it('normalizes pg NUMERIC strings in campaign and listing DTOs', async () => {
    const f = fixture();
    const detail = await f.service.detail(userId, accountId, '100');
    expect(detail.campaign.bidPercentage).toBe(5);
    expect(detail.campaign.sellerHillListingCount).toBe(1);
    expect(detail.listings[0]).toMatchObject({ price: 14.49, adRate: 5.5, appliedAdRate: 5.5, priceLocked: true });
  });
});
