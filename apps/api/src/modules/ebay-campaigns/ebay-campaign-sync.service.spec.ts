import { EbayCallPriority, ListingStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';

import { TestCampaignAccountLock } from './campaign-account-lock.test-helper';
import { CampaignAdStateRepository } from './campaign-ad-state.repository';
import { EbayCampaignActionsService } from './ebay-campaign-actions.service';
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

function setup(accountLockOverride?: TestCampaignAccountLock) {
  const state = {
    pending: new Map<string, string>(),
    revision: 0,
    appliedRate: 5.5,
    changedRows: [{ product_id: 'p1', changed: true }],
    inTransaction: false,
  };
  let metadata: Array<{ campaignId: string; status: string; fundingModel: string; adRateStrategy: string | null }> = [];
  let snapshot: { pending: Map<string, string>; appliedRate: number } | undefined;
  const db = {
    logger: { error: jest.fn() },
    get transaction() {
      return DatabaseService.prototype.transaction.bind(this as unknown as DatabaseService);
    },
    getClient: jest.fn(),
    query: jest.fn((sql: string, params?: unknown[]): Array<Record<string, unknown>> => {
      if (sql === 'BEGIN') {
        state.inTransaction = true;
        snapshot = { pending: new Map(state.pending), appliedRate: state.appliedRate };
      }
      if (sql === 'COMMIT') {
        state.inTransaction = false;
      }
      if (sql === 'ROLLBACK') {
        state.inTransaction = false;
        state.pending = new Map(snapshot!.pending);
        state.appliedRate = snapshot!.appliedRate;
      }
      if (sql.includes('WITH due')) {
        return [account];
      }
      if (sql.includes('SELECT id, ebay_item_id')) {
        return [
          { id: 'listing-1', ebay_item_id: '1' },
          { id: 'listing-2', ebay_item_id: '2' },
        ];
      }
      if (sql.includes('SELECT campaign_id')) {
        return metadata.map((c) => ({
          campaign_id: c.campaignId,
          status: c.status,
          funding_model: c.fundingModel,
          ad_rate_strategy: c.adRateStrategy,
        }));
      }
      if (sql.includes('INSERT INTO ebay_campaigns')) {
        metadata = JSON.parse(String(params?.[1])) as typeof metadata;
      }
      if (sql.includes('UPDATE listings')) {
        state.appliedRate = sql.includes('unnest') ? Number((params?.[5] as number[])[0]) : 0;
        return state.changedRows;
      }
      if (sql.includes('INSERT INTO ebay_campaign_reprice_outbox')) {
        for (const id of params?.[1] as string[]) {
          state.pending.set(id, String(++state.revision));
        }
      }
      if (sql.includes('SELECT product_id, revision')) {
        return [...state.pending].map(([product_id, revision]) => ({ product_id, revision }));
      }
      if (sql.includes('DELETE FROM ebay_campaign_reprice_outbox')) {
        if (state.pending.get(String(params?.[1])) === params?.[2]) {
          state.pending.delete(String(params?.[1]));
        }
      }
      return [];
    }),
  };
  const transactionClient = {
    query: jest.fn((sql: string, params?: unknown[]) => Promise.resolve({ rows: db.query(sql, params) })),
    release: jest.fn(),
  };
  db.getClient.mockResolvedValue(transactionClient);
  const settings = { getBoolean: jest.fn().mockResolvedValue(true), getNumber: jest.fn().mockResolvedValue(6) };
  const quota = { isSuspended: jest.fn().mockResolvedValue(false) };
  const ebay = { getAccountApiContext: jest.fn().mockResolvedValue({ accessToken: 'test', marketplaceId: 'EBAY_US' }) };
  const client = {
    getCampaigns: jest.fn().mockResolvedValue(page(campaign())),
    getAds: jest.fn().mockResolvedValue(ads()),
  };
  const stock = { enqueueProductStockSync: jest.fn().mockResolvedValue(undefined) };
  const repository = new CampaignAdStateRepository(db as never);
  const accountLock = accountLockOverride ?? new TestCampaignAccountLock();
  const service = new EbayCampaignSyncService(
    db as never,
    settings as never,
    quota as never,
    ebay as never,
    client as never,
    repository,
    stock as never,
    accountLock as never
  );
  const queries = () => db.query.mock.calls.map(([sql, params]) => ({ sql, params }));
  const writes = () => queries().filter(({ sql }) => sql.includes('UPDATE listings'));
  const deletes = () => queries().filter(({ sql }) => sql.includes('DELETE FROM ebay_campaigns'));
  return {
    db,
    settings,
    quota,
    ebay,
    client,
    stock,
    service,
    repository,
    accountLock,
    state,
    transactionClient,
    queries,
    writes,
    deletes,
  };
}

describe('campaign sweep using the real ad-state repository', () => {
  it('serializes a rate mutation behind an in-flight remote snapshot for the same account', async () => {
    const accountLock = new TestCampaignAccountLock();
    const f = setup(accountLock);
    const events: string[] = [];
    let releaseSnapshot!: () => void;
    let signalSnapshot!: () => void;
    const snapshotEntered = new Promise<void>((resolve) => {
      signalSnapshot = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    f.client.getCampaigns.mockImplementation(async () => {
      events.push('snapshot-start');
      signalSnapshot();
      await snapshotGate;
      events.push('snapshot-end');
      return page(campaign());
    });
    f.repository.writeAdState = jest.fn(() => {
      events.push('sync-commit');
      return Promise.resolve([]);
    });
    const syncPromise = f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    await snapshotEntered;

    const actionDatabase = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FROM ebay_accounts')) {
          return [{ id: account.id, user_id: account.user_id, status: 'active' }];
        }
        if (sql.includes('FROM ebay_campaigns')) {
          return [{
            campaign_id: 'c1', name: 'c1', status: 'RUNNING', funding_model: 'COST_PER_SALE',
            ad_rate_strategy: 'FIXED', bid_percentage: '5.5', rule_based: false,
          }];
        }
        return [];
      }),
    };
    const actionClient = {
      updateDefaultRate: jest.fn(() => {
        events.push('action-rate');
        return Promise.resolve();
      }),
      bulkUpdateBids: jest.fn(),
    };
    const actionService = new EbayCampaignActionsService(
      actionDatabase as never,
      actionClient as never,
      { getEligibility: jest.fn().mockResolvedValue({ status: 'ELIGIBLE' }) } as never,
      { isSuspended: jest.fn().mockResolvedValue(false) } as never,
      { getAccountApiContext: jest.fn().mockResolvedValue({}) } as never,
      { writeAdState: jest.fn(), recordPendingReprices: jest.fn() } as never,
      { flushPendingRepricing: jest.fn().mockResolvedValue([]) } as never,
      accountLock as never
    );
    const ratePromise = actionService.rate(account.user_id, 'c1', {
      ebayAccountId: account.id,
      bidPercentage: 8,
    });
    expect(accountLock.queuedAccounts).toEqual([account.id, account.id]);
    expect(actionClient.updateDefaultRate).not.toHaveBeenCalled();
    releaseSnapshot();
    await Promise.all([syncPromise, ratePromise]);

    expect(events).toEqual(['snapshot-start', 'snapshot-end', 'sync-commit', 'action-rate']);
  });

  it('ENDED skips documented 35035 getAds rejection, clears and reprices with complete coverage', async () => {
    const f = setup();
    f.client.getCampaigns.mockResolvedValue(page(campaign('c1', 'ENDED')));
    f.client.getAds.mockRejectedValue({
      response: { status: 400, data: { errors: [{ errorId: 35035, message: 'The campaign has ended.' }] } },
    });
    expect(await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).toEqual({
      campaigns: 1,
      complete: true,
      repricedProducts: 1,
    });
    expect(f.client.getAds).not.toHaveBeenCalled();
    expect(f.state.appliedRate).toBe(0);
    expect(f.stock.enqueueProductStockSync).toHaveBeenCalledWith('p1', 'campaign-store-1-1');
  });
  it('failed first enqueue and subsequent unsent products survive until the next unchanged sweep', async () => {
    const f = setup();
    f.state.changedRows = [
      { product_id: 'p1', changed: true },
      { product_id: 'p2', changed: true },
    ];
    f.stock.enqueueProductStockSync.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).rejects.toThrow('Redis unavailable');
    expect([...f.state.pending.keys()]).toEqual(['p1', 'p2']);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([['p1', 'campaign-store-1-1']]);
    f.state.changedRows = [
      { product_id: 'p1', changed: false },
      { product_id: 'p2', changed: false },
    ];
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([
      ['p1', 'campaign-store-1-1'],
      ['p1', 'campaign-store-1-1'],
      ['p2', 'campaign-store-1-2'],
    ]);
    expect(f.state.pending.size).toBe(0);
  });
  it('queue submission waits for commit; clear failure rolls back set and pending delivery atomically', async () => {
    const f = setup();
    const query = f.db.query.getMockImplementation()!;
    f.db.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('UPDATE listings') && sql.includes('<> ALL')) {
        throw new Error('clear failed');
      }
      return query(sql, params);
    });
    f.client.getAds.mockResolvedValue(ads('1', '7.0'));
    await expect(f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).rejects.toThrow('clear failed');
    expect(f.state.appliedRate).toBe(5.5);
    expect(f.state.pending.size).toBe(0);
    expect(f.stock.enqueueProductStockSync).not.toHaveBeenCalled();
    expect(f.queries().some(({ sql }) => sql === 'ROLLBACK')).toBe(true);
    expect(f.queries().some(({ sql }) => sql === 'COMMIT')).toBe(false);
    expect(f.transactionClient.release).toHaveBeenCalledTimes(1);
  });
  it('pending insert failure rolls back both listing writes and never submits a job', async () => {
    const f = setup();
    const query = f.db.query.getMockImplementation()!;
    f.db.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO ebay_campaign_reprice_outbox')) {
        throw new Error('outbox failed');
      }
      return query(sql, params);
    });
    await expect(f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).rejects.toThrow('outbox failed');
    expect(f.state.appliedRate).toBe(5.5);
    expect(f.stock.enqueueProductStockSync).not.toHaveBeenCalled();
  });
  it('successful enqueue occurs after COMMIT and before revision-specific acknowledgement', async () => {
    const f = setup();
    f.stock.enqueueProductStockSync.mockImplementation(() => {
      expect(f.state.inTransaction).toBe(false);
      expect(f.queries().some(({ sql }) => sql === 'COMMIT')).toBe(true);
      expect(f.state.pending.get('p1')).toBe('1');
    });
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    const ack = f.queries().find(({ sql }) => sql.includes('DELETE FROM ebay_campaign_reprice_outbox'))!;
    expect(ack.sql).toContain('revision = $3');
    expect(ack.params).toEqual(['store-1', 'p1', '1']);
    const outbox = f.queries().find(({ sql }) => sql.includes('INSERT INTO ebay_campaign_reprice_outbox'))!;
    expect(outbox.sql).toContain('revision = EXCLUDED.revision');
  });
  it('acknowledging an older delivery preserves a concurrent newer revision for redelivery', async () => {
    const f = setup();
    let concurrent = true;
    f.stock.enqueueProductStockSync.mockImplementation(async () => {
      if (concurrent) {
        concurrent = false;
        await f.repository.writeAdState(account.id, new Map([['1', { campaignId: 'c1', rate: 7 }]]), false);
      }
    });
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.state.pending.get('p1')).toBe('2');
    f.state.changedRows = [];
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([
      ['p1', 'campaign-store-1-1'],
      ['p1', 'campaign-store-1-2'],
    ]);
    expect(f.state.pending.size).toBe(0);
  });
  it('old acknowledgement cannot consume a new row after another consumer deleted its revision', async () => {
    const f = setup();
    let concurrent = true;
    f.stock.enqueueProductStockSync.mockImplementation(async () => {
      if (concurrent) {
        concurrent = false;
        await f.repository.acknowledgeReprice(account.id, 'p1', '1');
        expect(f.state.pending.size).toBe(0);
        await f.repository.writeAdState(account.id, new Map([['1', { campaignId: 'c1', rate: 8 }]]), false);
      }
    });
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.state.pending.get('p1')).toBe('2');
    f.state.changedRows = [];
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([
      ['p1', 'campaign-store-1-1'],
      ['p1', 'campaign-store-1-2'],
    ]);
  });
  it('acknowledgement failure redelivers the same durable job identity next sweep', async () => {
    const f = setup();
    const query = f.db.query.getMockImplementation()!;
    let rejectAck = true;
    f.db.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (rejectAck && sql.includes('DELETE FROM ebay_campaign_reprice_outbox')) {
        rejectAck = false;
        throw new Error('ack failed');
      }
      return query(sql, params);
    });
    await expect(f.service.syncAccount(account, EbayCallPriority.INTERACTIVE)).rejects.toThrow('ack failed');
    expect(f.state.pending.get('p1')).toBe('1');
    f.state.changedRows = [];
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([
      ['p1', 'campaign-store-1-1'],
      ['p1', 'campaign-store-1-1'],
    ]);
    expect(f.state.pending.size).toBe(0);
  });
  it('pending-only claim delivers without remote reads or advancing the campaign sync watermark', async () => {
    const f = setup();
    const query = f.db.query.getMockImplementation()!;
    f.state.pending.set('p1', '42');
    f.db.query.mockImplementation((sql: string, params?: unknown[]) =>
      sql.includes('WITH due') ? [{ ...account, sync_due: false }] : query(sql, params)
    );
    await f.service.runSweep();
    const claim = f.queries()[0];
    expect(claim.sql).toContain('ebay_campaign_reprice_outbox');
    expect(claim.sql).toContain('CASE WHEN due.sync_due THEN NOW() ELSE a.last_campaign_sync_at END');
    expect(f.client.getCampaigns).not.toHaveBeenCalled();
    expect(f.ebay.getAccountApiContext).not.toHaveBeenCalled();
    expect(f.stock.enqueueProductStockSync).toHaveBeenCalledWith('p1', 'campaign-store-1-42');
  });
  it('a due account with pending delivery still performs its remote sweep', async () => {
    const f = setup();
    const query = f.db.query.getMockImplementation()!;
    f.state.pending.set('p1', '42');
    f.state.revision = 42;
    f.db.query.mockImplementation((sql: string, params?: unknown[]) =>
      sql.includes('WITH due') ? [{ ...account, sync_due: true }] : query(sql, params)
    );
    await f.service.runSweep();
    expect(f.client.getCampaigns).toHaveBeenCalledTimes(1);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([
      ['p1', 'campaign-store-1-42'],
      ['p1', 'campaign-store-1-43'],
    ]);
  });
  it('suspended owners keep pending delivery without submitting jobs', async () => {
    const f = setup();
    f.state.pending.set('p1', '42');
    f.quota.isSuspended.mockResolvedValue(true);
    await f.service.runSweep();
    expect(f.stock.enqueueProductStockSync).not.toHaveBeenCalled();
    expect(f.state.pending.get('p1')).toBe('42');
  });
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
    expect(set.params).toEqual([
      'store-1', ['1', '2'], ['c1', 'c2'], [5.5, 7], ['FIXED', 'FIXED'], [5.5, 0],
      ['listing-1', 'listing-2'], ListingStatus.ACTIVE,
    ]);
    expect(set.sql).toContain('old.ad_rate_applied IS DISTINCT FROM v.applied');
    expect(set.sql).toContain('l.ebay_account_id = $1');
    expect(f.writes().some(({ sql }) => sql.includes('<> ALL'))).toBe(true);
    expect(f.deletes()).toHaveLength(1);
  });
  it('deduplicates changed products and does not enqueue unchanged products', async () => {
    const f = setup();
    const defaultQuery = f.db.query.getMockImplementation()!;
    f.db.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id, ebay_item_id')) {
        return [{ id: 'listing-1', ebay_item_id: '1' }];
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
      return defaultQuery(sql, params);
    });
    await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
    expect(f.stock.enqueueProductStockSync.mock.calls).toEqual([['p1', 'campaign-store-1-1']]);
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
      expect(clear.sql).toContain('id = ANY($3::uuid[]) AND status = $4');
      expect(clear.params).toEqual([
        'store-1',
        status === 'PAUSED' ? ['1'] : [],
        ['listing-1', 'listing-2'],
        ListingStatus.ACTIVE,
      ]);
      expect(f.stock.enqueueProductStockSync).toHaveBeenCalledWith('p1', 'campaign-store-1-1');
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
    expect(f.writes()[0].params).toEqual([
      'store-1', [], ['listing-1', 'listing-2'], ListingStatus.ACTIVE,
    ]);
  });

  it.each(['0', '101', '5.55'])(
    'invalid remote campaign rate %s preserves prior applied listing rate',
    async (bidPercentage) => {
      const f = setup();
      const row = campaign();
      row.fundingStrategy.bidPercentage = bidPercentage;
      f.client.getCampaigns.mockResolvedValue(page(row));
      const result = await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
      expect(result.complete).toBe(false);
      expect(f.state.appliedRate).toBe(5.5);
      expect(f.writes()).toEqual([]);
    }
  );

  it.each(['0', '101', '5.55'])(
    'invalid remote per-ad rate %s preserves prior applied listing rate',
    async (bidPercentage) => {
      const f = setup();
      f.client.getAds.mockResolvedValueOnce(ads()).mockResolvedValueOnce(ads('1', bidPercentage));
      const result = await f.service.syncAccount(account, EbayCallPriority.INTERACTIVE);
      expect(result.complete).toBe(false);
      expect(f.state.appliedRate).toBe(5.5);
      expect(f.writes()).toEqual([]);
    }
  );
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
      if (sql.includes('SELECT id, ebay_item_id')) {
        return [...Array.from({ length: 501 }, (_, i) => ({ id: `listing-${i}`, ebay_item_id: String(i) })), { id: 'duplicate', ebay_item_id: '1' }];
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
      const set = f.writes().find(({ sql }) => sql.includes('unnest'))!;
      expect(set.params?.[4]).toEqual(['FIXED']);
      expect(set.params?.[5]).toEqual([5.5]);
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
