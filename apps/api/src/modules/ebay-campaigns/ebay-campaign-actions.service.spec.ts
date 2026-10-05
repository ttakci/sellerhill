import { CampaignAction, CampaignAddOutcome } from '@repo/shared';

import { TestCampaignAccountLock } from './campaign-account-lock.test-helper';
import { EbayCampaignActionsService } from './ebay-campaign-actions.service';

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const listing1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const listing2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const listing3 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function fixture(accountLock = new TestCampaignAccountLock(), lockedAccountId = accountId) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let campaign = {
    campaign_id: '100',
    bid_percentage: '5.0',
    status: 'RUNNING',
    funding_model: 'COST_PER_SALE',
    ad_rate_strategy: 'FIXED',
    rule_based: false,
  };
  const database = {
    query: jest.fn((sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('FROM ebay_accounts')) {
        return [{ id: lockedAccountId, user_id: userId, status: 'active' }];
      }
      if (sql.includes('FROM ebay_campaigns')) {
        return [
          {
            ...campaign,
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            synced_at: new Date(),
            created_by_sellerhill: true,
            listing_count: '1',
          },
        ];
      }
      if (sql.includes('FROM listings')) {
        return [
          {
            id: listing1,
            ebay_item_id: '1',
            product_id: listing1,
            promoted_campaign_id: null,
            promoted_ad_rate: null,
            ad_rate_applied: '0',
          },
          {
            id: listing2,
            ebay_item_id: '2',
            product_id: listing2,
            promoted_campaign_id: null,
            promoted_ad_rate: null,
            ad_rate_applied: '0',
          },
        ];
      }
      return [];
    }),
    transaction: jest.fn(async (callback: (client: { query: jest.Mock }) => Promise<unknown>) =>
      callback({
        query: jest.fn((sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          return { rows: [{ product_id: listing1, changed: true }] };
        }),
      })
    ),
  };
  const client = {
    createCampaign: jest.fn(),
    getCampaign: jest.fn(),
    bulkCreateAds: jest.fn(),
    bulkDeleteAds: jest.fn(),
    bulkUpdateBids: jest.fn(),
    updateDefaultRate: jest.fn(),
    campaignAction: jest.fn(),
  };
  const eligibility = { getEligibility: jest.fn().mockResolvedValue({ status: 'ELIGIBLE', reason: null }) };
  const quota = { isSuspended: jest.fn().mockResolvedValue(false) };
  const ebay = { getAccountApiContext: jest.fn().mockResolvedValue({ accessToken: 'fake', marketplaceId: 'EBAY_US' }) };
  const repository = { upsertCampaigns: jest.fn(), recordPendingReprices: jest.fn(), writeAdState: jest.fn() };
  const sync = { flushPendingRepricing: jest.fn() };
  const service = new EbayCampaignActionsService(
    database as never,
    client as never,
    eligibility as never,
    quota as never,
    ebay as never,
    repository as never,
    sync as never,
    accountLock as never
  );
  return {
    service,
    accountLock,
    lockedAccountId,
    database,
    client,
    eligibility,
    quota,
    ebay,
    repository,
    sync,
    queries,
    setCampaign: (patch: Partial<typeof campaign>) => {
      campaign = { ...campaign, ...patch };
    },
  };
}

describe('EbayCampaignActionsService', () => {
  it.each([5.55, 1, 101])('rejects invalid rate %s before eligibility or Marketing', async (rate) => {
    const f = fixture();
    await expect(
      f.service.rate(userId, '100', { ebayAccountId: accountId, bidPercentage: rate })
    ).rejects.toMatchObject({ key: 'campaigns.errors.invalidRate' });
    expect(f.eligibility.getEligibility).not.toHaveBeenCalled();
    expect(f.client.updateDefaultRate).not.toHaveBeenCalled();
  });

  it('rejects a suspended seller before Marketing', async () => {
    const f = fixture();
    f.quota.isSuspended.mockResolvedValue(true);
    await expect(
      f.service.add(userId, '100', { ebayAccountId: accountId, listingIds: [listing1] })
    ).rejects.toMatchObject({ key: 'campaigns.errors.suspended' });
    expect(f.client.bulkCreateAds).not.toHaveBeenCalled();
  });

  it('rejects an ineligible seller before Marketing', async () => {
    const f = fixture();
    f.eligibility.getEligibility.mockResolvedValue({ status: 'INELIGIBLE', reason: 'test' });
    await expect(
      f.service.add(userId, '100', { ebayAccountId: accountId, listingIds: [listing1] })
    ).rejects.toMatchObject({ key: 'campaigns.errors.ineligible' });
    expect(f.client.bulkCreateAds).not.toHaveBeenCalled();
  });

  it.each([
    [{ rule_based: true }, 'rule_based'],
    [{ funding_model: 'COST_PER_CLICK' }, 'cost_per_click'],
    [{ ad_rate_strategy: 'DYNAMIC' }, 'dynamic_rate'],
    [{ status: 'ENDED' }, 'ended'],
  ])('rejects a read-only campaign with reason %s', async (patch, reason) => {
    const f = fixture();
    f.setCampaign(patch);
    await expect(
      f.service.remove(userId, '100', { ebayAccountId: accountId, listingIds: [listing1] })
    ).rejects.toMatchObject({ key: 'campaigns.errors.readOnly', reason });
    expect(f.client.bulkDeleteAds).not.toHaveBeenCalled();
  });

  it('rejects an invalid stored add rate before eligibility is called', async () => {
    const f = fixture();
    f.setCampaign({ bid_percentage: '5.55' });
    await expect(
      f.service.add(userId, '100', { ebayAccountId: accountId, listingIds: [listing1] })
    ).rejects.toMatchObject({ key: 'campaigns.errors.invalidRate' });
    expect(f.eligibility.getEligibility).not.toHaveBeenCalled();
  });

  it('refuses malformed listing arrays before any eBay call', async () => {
    const f = fixture();
    await expect(f.service.add(userId, '100', { ebayAccountId: accountId, listingIds: ['bad'] })).rejects.toMatchObject(
      { status: 400 }
    );
    expect(f.eligibility.getEligibility).not.toHaveBeenCalled();
  });

  it('rejects invalid create rate before eligibility and campaign reads', async () => {
    const f = fixture();
    await expect(
      f.service.create(userId, { ebayAccountId: accountId, name: 'New', bidPercentage: 5.55 })
    ).rejects.toMatchObject({ key: 'campaigns.errors.invalidRate' });
    expect(f.eligibility.getEligibility).not.toHaveBeenCalled();
    expect(f.client.createCampaign).not.toHaveBeenCalled();
  });

  it('creates a campaign using the status eBay returns, including PAUSED', async () => {
    const f = fixture();
    f.client.createCampaign.mockResolvedValue({ campaignId: '200', nameTaken: false });
    f.client.getCampaign.mockResolvedValue({
      campaignId: '200',
      campaignName: 'New',
      campaignStatus: 'PAUSED',
      fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '5.0' },
    });

    const result = await f.service.create(userId, { ebayAccountId: accountId, name: 'New', bidPercentage: 5 });

    expect(result.status).toBe('PAUSED');
    expect(f.client.getCampaign).toHaveBeenCalledWith(expect.anything(), '200', expect.anything());
    expect(f.repository.upsertCampaigns).toHaveBeenCalledWith(
      accountId,
      [expect.objectContaining({ status: 'PAUSED' })],
      false
    );
  });

  it('keeps 35036 out of local ad state and records only successful adds', async () => {
    const f = fixture();
    f.client.bulkCreateAds.mockResolvedValue({
      responses: [
        { listingId: '1', statusCode: 201 },
        { listingId: '2', statusCode: 400, errors: [{ errorId: 35036 }] },
      ],
    });
    const result = await f.service.add(userId, '100', { ebayAccountId: accountId, listingIds: [listing1, listing2] });
    expect(result.results).toEqual([
      { listingId: listing1, outcome: CampaignAddOutcome.ADDED },
      { listingId: listing2, outcome: CampaignAddOutcome.ALREADY_IN_CAMPAIGN },
    ]);
    expect(f.repository.writeAdState).toHaveBeenCalledWith(
      accountId,
      new Map([['1', { campaignId: '100', rate: 5 }]]),
      false
    );
    expect(f.sync.flushPendingRepricing).toHaveBeenCalledWith(accountId);
    expect(f.queries.some((q) => q.sql.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('does not send an unowned or already promoted listing to eBay', async () => {
    const f = fixture();
    (f.database.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => {
      f.queries.push({ sql, params });
      if (sql.includes('FROM ebay_accounts')) {
        return [{ id: accountId, user_id: userId, status: 'active' }];
      }
      if (sql.includes('FROM ebay_campaigns')) {
        return [
          {
            campaign_id: '100',
            bid_percentage: '5.0',
            status: 'RUNNING',
            funding_model: 'COST_PER_SALE',
            ad_rate_strategy: 'FIXED',
            rule_based: false,
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            synced_at: new Date(),
            created_by_sellerhill: true,
            listing_count: '1',
          },
        ];
      }
      return [];
    });
    const result = await f.service.add(userId, '100', { ebayAccountId: accountId, listingIds: [listing1] });
    expect(result.results).toEqual([{ listingId: listing1, outcome: CampaignAddOutcome.FAILED }]);
    expect(f.client.bulkCreateAds).not.toHaveBeenCalled();
  });

  it('removes only an owned ad and records pending delivery in the listing transaction', async () => {
    const f = fixture();
    f.client.bulkDeleteAds.mockResolvedValue({ responses: [{ listingId: '1', statusCode: 200 }] });
    await f.service.remove(userId, '100', { ebayAccountId: accountId, listingIds: [listing1] });
    const write = f.queries.find((q) => q.sql.includes('SET promoted_campaign_id = NULL'));
    expect(write?.params[3]).toContain(listing1);
    expect(write?.sql).toContain('ad_rate_applied = 0');
    expect(f.repository.recordPendingReprices).toHaveBeenCalled();
    expect(f.sync.flushPendingRepricing).toHaveBeenCalledWith(accountId);
  });

  it.each(['remove', 'rate'] as const)(
    '%s accepts inactive members but excludes another campaign and store',
    async (kind) => {
      const f = fixture();
      const listings = [
        {
          id: listing1,
          ebay_item_id: '1',
          product_id: listing1,
          user_id: userId,
          ebay_account_id: accountId,
          status: 'inactive',
          promoted_campaign_id: '100',
          promoted_ad_rate: '5.0',
          ad_rate_applied: '5.0',
        },
        {
          id: listing2,
          ebay_item_id: '2',
          product_id: listing2,
          user_id: userId,
          ebay_account_id: accountId,
          status: 'active',
          promoted_campaign_id: 'another-campaign',
          promoted_ad_rate: '5.0',
          ad_rate_applied: '5.0',
        },
        {
          id: listing3,
          ebay_item_id: '3',
          product_id: listing3,
          user_id: userId,
          ebay_account_id: 'another-store',
          status: 'active',
          promoted_campaign_id: '100',
          promoted_ad_rate: '5.0',
          ad_rate_applied: '5.0',
        },
      ];
      (f.database.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => {
        f.queries.push({ sql, params });
        if (sql.includes('FROM ebay_accounts')) {
          return [{ id: accountId, user_id: userId, status: 'active' }];
        }
        if (sql.includes('FROM ebay_campaigns')) {
          return [
            {
              campaign_id: '100',
              bid_percentage: '5.0',
              status: 'RUNNING',
              funding_model: 'COST_PER_SALE',
              ad_rate_strategy: 'FIXED',
              rule_based: false,
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              synced_at: new Date(),
              created_by_sellerhill: true,
              listing_count: '1',
            },
          ];
        }
        if (sql.includes('FROM listings')) {
          const requireActive = sql.includes('status = $3');
          const listingIds = params[requireActive ? 3 : 2] as string[];
          const membershipCampaign = params[requireActive ? 4 : 3] as string;
          return listings.filter(
            (row) =>
              row.user_id === params[0] &&
              row.ebay_account_id === params[1] &&
              listingIds.includes(row.id) &&
              row.ebay_item_id !== null &&
              (!requireActive || row.status === params[2]) &&
              row.promoted_campaign_id === membershipCampaign
          );
        }
        return [];
      });
      f.client.bulkDeleteAds.mockResolvedValue({ responses: [{ listingId: '1', statusCode: 200 }] });
      f.client.bulkUpdateBids.mockResolvedValue({ responses: [{ listingId: '1', statusCode: 200 }] });
      const request = { ebayAccountId: accountId, listingIds: [listing1, listing2, listing3] };
      const result =
        kind === 'remove'
          ? await f.service.remove(userId, '100', request)
          : await f.service.rate(userId, '100', { ...request, bidPercentage: 6 });
      const listingRead = f.queries.find((q) => q.sql.includes('FROM listings') && q.sql.includes('id = ANY'));
      expect(listingRead?.sql).toContain('user_id = $1');
      expect(listingRead?.sql).toContain('ebay_account_id = $2');
      expect(listingRead?.sql).toContain('promoted_campaign_id = $4');
      expect(listingRead?.sql).not.toContain('status =');
      expect(listingRead?.params).toEqual([userId, accountId, [listing1, listing2, listing3], '100']);
      expect(result.results).toEqual([
        { listingId: listing1, outcome: CampaignAddOutcome.ADDED },
        { listingId: listing2, outcome: CampaignAddOutcome.FAILED },
        { listingId: listing3, outcome: CampaignAddOutcome.FAILED },
      ]);
      expect(kind === 'remove' ? f.client.bulkDeleteAds : f.client.bulkUpdateBids).toHaveBeenCalledWith(
        expect.anything(),
        '100',
        ['1'],
        ...(kind === 'rate' ? ['6.0'] : [])
      );
    }
  );

  it('changes a default rate and persists applied rates through the durable outbox', async () => {
    const f = fixture();
    f.client.bulkUpdateBids.mockResolvedValue({
      responses: [
        { listingId: '1', statusCode: 200 },
        { listingId: '2', statusCode: 200 },
      ],
    });
    await f.service.rate(userId, '100', { ebayAccountId: accountId, bidPercentage: 6 });
    expect(f.client.updateDefaultRate).toHaveBeenCalledWith(expect.anything(), '100', '6.0');
    expect(f.queries.some((q) => q.sql.includes('SET promoted_ad_rate = $5') && q.params[5] === 6)).toBe(true);
    expect(f.repository.recordPendingReprices).toHaveBeenCalled();
  });

  it('maps a taken campaign name to the fixed error key', async () => {
    const f = fixture();
    f.client.createCampaign.mockResolvedValue({ campaignId: null, nameTaken: true });
    await expect(
      f.service.create(userId, { ebayAccountId: accountId, name: 'Taken', bidPercentage: 5 })
    ).rejects.toMatchObject({ key: 'campaigns.errors.nameTaken' });
    expect(f.client.getCampaign).not.toHaveBeenCalled();
  });

  it('pauses on eBay, rereads its campaign, and durably queues changed rates', async () => {
    const f = fixture();
    f.client.getCampaign.mockResolvedValue({
      campaignId: '100',
      campaignName: 'Test',
      campaignStatus: 'PAUSED',
      fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '5.0' },
    });
    await f.service.action(userId, '100', accountId, CampaignAction.PAUSE);
    expect(f.client.campaignAction).toHaveBeenCalledWith(expect.anything(), '100', CampaignAction.PAUSE);
    expect(f.repository.recordPendingReprices).toHaveBeenCalled();
    expect(f.sync.flushPendingRepricing).toHaveBeenCalledWith(accountId);
  });

  it.each([
    {
      action: CampaignAction.PAUSE,
      status: 'PAUSED',
      funding: 'COST_PER_SALE',
      strategy: 'FIXED',
      old: 5.5,
      expected: 0,
      pending: [listing1],
    },
    {
      action: CampaignAction.RESUME,
      status: 'RUNNING',
      funding: 'COST_PER_SALE',
      strategy: 'FIXED',
      old: 0,
      expected: 5.5,
      pending: [listing1],
    },
    {
      action: CampaignAction.RESUME,
      status: 'RUNNING',
      funding: 'COST_PER_SALE',
      strategy: 'DYNAMIC',
      old: 0,
      expected: 0,
      pending: [],
    },
    {
      action: CampaignAction.RESUME,
      status: 'RUNNING',
      funding: 'COST_PER_CLICK',
      strategy: 'FIXED',
      old: 0,
      expected: 0,
      pending: [],
    },
    {
      action: CampaignAction.END,
      status: 'ENDED',
      funding: 'COST_PER_SALE',
      strategy: 'FIXED',
      old: 5.5,
      expected: 0,
      pending: [listing1],
    },
  ])(
    'action $action with fresh $status/$funding/$strategy applies $expected and delivers only changes',
    async (scenario) => {
      const f = fixture();
      const events: string[] = [];
      const secondListingApplied =
        scenario.status === 'RUNNING' && scenario.funding === 'COST_PER_SALE' && scenario.strategy === 'FIXED' ? 5 : 0;
      const rates = new Map([
        [listing1, scenario.old],
        [listing2, secondListingApplied],
      ]);
      const pending: string[] = [];
      let committed = false;
      let transactionClient: { query: jest.Mock } | undefined;
      f.client.campaignAction.mockImplementation(() => {
        events.push('action');
        return Promise.resolve();
      });
      f.client.getCampaign.mockImplementation(() => {
        events.push('getCampaign');
        return Promise.resolve({
          campaignId: '100',
          campaignName: 'Test',
          campaignStatus: scenario.status,
          fundingStrategy: { fundingModel: scenario.funding, adRateStrategy: scenario.strategy, bidPercentage: '5.0' },
        });
      });
      f.repository.upsertCampaigns.mockImplementation(() => {
        events.push('upsert');
        return Promise.resolve();
      });
      f.database.transaction.mockImplementation(
        async (callback: (client: { query: jest.Mock }) => Promise<unknown>) => {
          const txClient = {
            query: jest.fn((sql: string, params: unknown[]) => {
              events.push(sql.includes('FOR UPDATE') ? 'lock' : sql.includes('UPDATE listings') ? 'update' : 'members');
              if (sql.includes('FROM listings') && !sql.includes('UPDATE listings')) {
                return {
                  rows: [
                    {
                      id: listing1,
                      product_id: listing1,
                      promoted_ad_rate: '5.5',
                      ad_rate_applied: String(rates.get(listing1)),
                    },
                    {
                      id: listing2,
                      product_id: listing2,
                      promoted_ad_rate: '5.0',
                      ad_rate_applied: String(rates.get(listing2)),
                    },
                  ],
                };
              }
              if (sql.includes('UPDATE listings')) {
                const ids = params[3] as string[];
                const applied = params[4] as number[];
                if (!Array.isArray(ids) || !Array.isArray(applied)) {
                  throw new Error('action must send per-listing applied rates');
                }
                const changed = ids.map((id, index) => {
                  const old = rates.get(id) ?? 0;
                  rates.set(id, applied[index]);
                  return { product_id: id, changed: old !== applied[index] };
                });
                return { rows: changed };
              }
              return { rows: [] };
            }),
          };
          transactionClient = txClient;
          const result = await callback(txClient);
          committed = true;
          events.push('commit');
          return result;
        }
      );
      f.repository.recordPendingReprices.mockImplementation((tx: unknown, _account: string, products: string[]) => {
        expect(tx).toBe(transactionClient);
        events.push('outbox');
        pending.push(...products);
        return Promise.resolve();
      });
      f.sync.flushPendingRepricing.mockImplementation(() => {
        expect(committed).toBe(true);
        events.push('flush');
        return Promise.resolve([...pending]);
      });
      await f.service.action(userId, '100', accountId, scenario.action);
      expect(rates.get(listing1)).toBe(scenario.expected);
      expect(rates.get(listing2)).toBe(secondListingApplied);
      expect(pending).toEqual(scenario.pending);
      expect(events).toEqual([
        'action',
        'getCampaign',
        'upsert',
        'lock',
        'members',
        'update',
        'outbox',
        'commit',
        'flush',
      ]);
    }
  );
});
