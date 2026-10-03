// apps/api/src/modules/ebay-returns/ebay-returns.service.spec.ts

import { ACTIONABLE_RETURN_BUCKETS, buildReturnBucketSql, ReturnBucket, ReturnTab } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';

import { EbayReturnsService } from './ebay-returns.service';
import {
  buildReturnStoreActiveSql,
  buildStoreScopedReturnBucketSql,
  scopeReturnBucketToStore,
} from './return-store-scope';
import type { ReturnSweepScheduleService } from './return-sweep-schedule.service';

const USER = '00000000-0000-4000-8000-00000000000a';
const ACCOUNT = '11111111-1111-4111-8111-11111111111a';
// Sweep interval 6 h (the fake below) → the 24 h minimum freshness horizon.
const BUCKET_SQL = buildStoreScopedReturnBucketSql('r', 24);

const dbRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: '22222222-2222-4222-8222-222222222222',
  return_id: '5000000001',
  ebay_account_id: ACCOUNT,
  ebay_order_id: '12-34567-89012',
  order_id: '33333333-3333-4333-8333-333333333333',
  ebay_item_id: '110000000006',
  return_quantity: 1,
  state: 'RETURN_REQUESTED',
  status: 'RETURN_REQUESTED',
  reason: 'ARRIVED_DAMAGED',
  reason_type: 'SNAD',
  buyer_comment: 'The box arrived crushed.',
  buyer_login_name: 'buyer_one',
  seller_activity_due: 'SELLER_APPROVE_REQUEST',
  seller_respond_by: new Date('2999-01-01T00:00:00.000Z'),
  estimated_refund_amount: '27.50',
  actual_refund_amount: null,
  currency: 'USD',
  created_on_ebay_at: new Date('2026-09-28T10:00:00.000Z'),
  // Relative to the real clock: the DTO's bucket depends on how long ago eBay
  // last reported the row, so a fixed date would turn every row stale a day
  // after it was written.
  last_synced_at: new Date(Date.now() - 60 * 60 * 1000),
  listing_id: '44444444-4444-4444-8444-444444444444',
  listing_title: 'Steel water bottle',
  listing_asin: 'B0SH000001',
  product_image_urls: ['https://example.test/1.jpg', 'https://example.test/2.jpg'],
  store_active: true,
  ...over,
});

function build(
  options: { total?: number; rows?: Array<Record<string, unknown>>; counts?: unknown[]; intervalHours?: number } = {}
): {
  service: EbayReturnsService;
  query: jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;
} {
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) => {
    if (sql.includes('GROUP BY')) {
      return Promise.resolve(options.counts ?? []);
    }
    if (sql.includes('COUNT(*)')) {
      return Promise.resolve([{ count: options.total ?? 0 }]);
    }
    return Promise.resolve(options.rows ?? []);
  });
  const resolve = jest.fn(() =>
    Promise.resolve({ intervalHours: options.intervalHours ?? 6, source: 'auto' as const, estimatedDailyCalls: 0 })
  );
  return {
    service: new EbayReturnsService(
      { query } as unknown as DatabaseService,
      { resolve } as unknown as ReturnSweepScheduleService
    ),
    query,
  };
}

describe('EbayReturnsService.list', () => {
  it('scopes both queries to the caller and pages with the defaults', async () => {
    const { service, query } = build({ total: 0 });

    const result = await service.list(USER);

    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    expect(query).toHaveBeenCalledTimes(2);
    const [countSql, countParams] = query.mock.calls[0];
    const [pageSql, pageParams] = query.mock.calls[1];
    expect(countSql).toContain('WHERE r.user_id = $1');
    expect(pageSql).toContain('WHERE r.user_id = $1');
    expect(countParams).toEqual([USER]);
    expect(pageParams).toEqual([USER, [...ACTIONABLE_RETURN_BUCKETS], 20, 0]);
  });

  it('orders actionable returns first, then by deadline, then newest', async () => {
    const { service, query } = build();

    await service.list(USER);

    const [pageSql] = query.mock.calls[1];
    const orderBy = pageSql.slice(pageSql.indexOf('ORDER BY'));
    expect(orderBy).toContain(`CASE WHEN ${BUCKET_SQL} = ANY($2::text[]) THEN 0 ELSE 1 END`);
    const deadline = orderBy.indexOf('r.seller_respond_by ASC NULLS LAST');
    const created = orderBy.indexOf('r.created_on_ebay_at DESC');
    expect(deadline).toBeGreaterThan(-1);
    expect(created).toBeGreaterThan(deadline);
    expect(orderBy).toContain('LIMIT $3 OFFSET $4');
  });

  it.each([
    [{ page: 3, limit: 50 }, 3, 50, 100],
    [{ page: 0, limit: 0 }, 1, 20, 0],
    [{ page: -4, limit: -1 }, 1, 20, 0],
    [{ page: 2, limit: 5000 }, 2, 100, 100],
    [{ page: Number.NaN, limit: Number.NaN }, 1, 20, 0],
    [{ page: 2.9, limit: 10.9 }, 2, 10, 10],
  ])('clamps paging %j', async (input, page, limit, offset) => {
    const { service, query } = build();

    const result = await service.list(USER, input);

    expect(result.page).toBe(page);
    expect(result.limit).toBe(limit);
    expect(query.mock.calls[1][1]?.slice(-2)).toEqual([limit, offset]);
  });

  it.each([
    [ReturnTab.ACTION, [ReturnBucket.ACTION_OVERDUE, ReturnBucket.ACTION_DUE]],
    [ReturnTab.IN_PROGRESS, [ReturnBucket.IN_PROGRESS, ReturnBucket.ESCALATED, ReturnBucket.UNCONFIRMED]],
    [ReturnTab.CLOSED, [ReturnBucket.CLOSED]],
  ])('filters the %s tab through the bucket CASE', async (tab, buckets) => {
    const { service, query } = build();

    await service.list(USER, { tab });

    const [countSql, countParams] = query.mock.calls[0];
    expect(countSql).toContain(`AND ${BUCKET_SQL} = ANY($2::text[])`);
    expect(countParams).toEqual([USER, buckets]);
    expect(query.mock.calls[1][0]).toContain(`AND ${BUCKET_SQL} = ANY($2::text[])`);
  });

  it('adds no bucket filter for the ALL tab or an unknown one', async () => {
    const { service, query } = build();

    await service.list(USER, { tab: ReturnTab.ALL });
    await service.list(USER, { tab: 'nonsense' as ReturnTab });

    for (const index of [0, 2]) {
      const [countSql, countParams] = query.mock.calls[index];
      expect(countSql).not.toContain('ANY(');
      expect(countParams).toEqual([USER]);
    }
  });

  it('filters by store and searches the return id, the eBay order id and the product title', async () => {
    const { service, query } = build();

    await service.list(USER, { tab: ReturnTab.CLOSED, ebayAccountId: ACCOUNT, search: '  50%_off\\ ' });

    const [countSql, countParams] = query.mock.calls[0];
    expect(countSql).toContain('AND r.ebay_account_id = $3::uuid');
    expect(countSql).toContain('AND (r.return_id ILIKE $4 OR r.ebay_order_id ILIKE $4 OR l.title ILIKE $4)');
    // LIKE wildcards in the term are literals.
    expect(countParams).toEqual([USER, [ReturnBucket.CLOSED], ACCOUNT, '%50\\%\\_off\\\\%']);

    const [pageSql, pageParams] = query.mock.calls[1];
    expect(pageSql).toContain('ANY($5::text[])');
    expect(pageSql).toContain('LIMIT $6 OFFSET $7');
    expect(pageParams).toEqual([
      USER,
      [ReturnBucket.CLOSED],
      ACCOUNT,
      '%50\\%\\_off\\\\%',
      [...ACTIONABLE_RETURN_BUCKETS],
      20,
      0,
    ]);
  });

  it('ignores a blank search', async () => {
    const { service, query } = build();

    await service.list(USER, { search: '   ' });

    expect(query.mock.calls[0][0]).not.toContain('ILIKE');
    expect(query.mock.calls[0][1]).toEqual([USER]);
  });

  it('maps a row to the DTO, with the bucket derived from the row', async () => {
    const { service } = build({ total: 1, rows: [dbRow()] });

    const result = await service.list(USER);

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        id: '22222222-2222-4222-8222-222222222222',
        returnId: '5000000001',
        ebayAccountId: ACCOUNT,
        ebayOrderId: '12-34567-89012',
        orderId: '33333333-3333-4333-8333-333333333333',
        ebayItemId: '110000000006',
        returnQuantity: 1,
        bucket: ReturnBucket.ACTION_DUE,
        state: 'RETURN_REQUESTED',
        status: 'RETURN_REQUESTED',
        reason: 'ARRIVED_DAMAGED',
        reasonType: 'SNAD',
        buyerComment: 'The box arrived crushed.',
        buyerLoginName: 'buyer_one',
        sellerActivityDue: 'SELLER_APPROVE_REQUEST',
        sellerRespondBy: '2999-01-01T00:00:00.000Z',
        estimatedRefundAmount: 27.5,
        actualRefundAmount: null,
        currency: 'USD',
        createdOnEbayAt: '2026-09-28T10:00:00.000Z',
        lastSyncedAt: expect.any(String) as unknown as string,
        product: {
          title: 'Steel water bottle',
          imageUrl: 'https://example.test/1.jpg',
          asin: 'B0SH000001',
        },
      },
    ]);
  });

  it('derives each bucket from the stored eBay values', async () => {
    const { service } = build({
      rows: [
        dbRow({ seller_respond_by: new Date('2001-01-01T00:00:00.000Z') }),
        dbRow({ status: 'ESCALATED' }),
        dbRow({ state: 'CLOSED', status: 'CLOSED' }),
        dbRow({ seller_activity_due: null, seller_respond_by: null }),
      ],
    });

    const result = await service.list(USER);

    expect(result.items.map((item) => item.bucket)).toEqual([
      ReturnBucket.ACTION_OVERDUE,
      ReturnBucket.ESCALATED,
      ReturnBucket.CLOSED,
      ReturnBucket.IN_PROGRESS,
    ]);
  });

  it('carries no product when the return’s order is not one we track', async () => {
    const { service } = build({
      rows: [
        dbRow({ order_id: null, listing_id: null, listing_title: null, listing_asin: null, product_image_urls: null }),
      ],
    });

    const [item] = (await service.list(USER)).items;

    expect(item.orderId).toBeNull();
    expect(item.product).toBeNull();
  });

  it('reads the first image from a JSON string and tolerates junk', async () => {
    const { service } = build({
      rows: [
        dbRow({ product_image_urls: '["https://example.test/a.jpg"]' }),
        dbRow({ product_image_urls: 'not json' }),
        dbRow({ product_image_urls: [] }),
      ],
    });

    const items = (await service.list(USER)).items;

    expect(items.map((item) => item.product?.imageUrl)).toEqual(['https://example.test/a.jpg', null, null]);
  });

  it('keeps a zero refund apart from an unknown one', async () => {
    const { service } = build({ rows: [dbRow({ estimated_refund_amount: '0.00', actual_refund_amount: null })] });

    const [item] = (await service.list(USER)).items;

    expect(item.estimatedRefundAmount).toBe(0);
    expect(item.actualRefundAmount).toBeNull();
  });
});

describe('store scope (one predicate for the Returns page and the Action Center)', () => {
  it('a return of a disconnected store stays listed but its action reads as unconfirmed', async () => {
    const { service, query } = build({
      rows: [
        dbRow({ store_active: false }),
        dbRow({ store_active: false, seller_respond_by: new Date('2001-01-01T00:00:00.000Z') }),
        dbRow({ store_active: false, state: 'CLOSED', status: 'CLOSED' }),
        dbRow({ store_active: false, seller_activity_due: null, seller_respond_by: null }),
      ],
    });

    const result = await service.list(USER);

    expect(result.items.map((item) => item.bucket)).toEqual([
      ReturnBucket.UNCONFIRMED,
      ReturnBucket.UNCONFIRMED,
      ReturnBucket.CLOSED,
      ReturnBucket.IN_PROGRESS,
    ]);
    // Visible: no store filter in the WHERE, the store state is only selected.
    expect(query.mock.calls[1][0]).toContain(`${buildReturnStoreActiveSql('r')} AS store_active`);
    expect(query.mock.calls[1][0]).not.toMatch(/JOIN ebay_accounts/);
  });

  it('the SQL demotes only action buckets of a non-active store, over the shared bucket', () => {
    const sql = buildStoreScopedReturnBucketSql('r', 24);
    expect(sql).toContain(buildReturnBucketSql('r', 24));
    expect(sql).toContain(`IN ('${ReturnBucket.ACTION_OVERDUE}', '${ReturnBucket.ACTION_DUE}')`);
    expect(sql).toContain(`AND NOT ${buildReturnStoreActiveSql('r')} THEN '${ReturnBucket.UNCONFIRMED}'`);
    expect(buildReturnStoreActiveSql('r')).toContain("ret_store.status = 'active'");
    expect(() => buildReturnStoreActiveSql('r; DROP')).toThrow();
  });

  it('the TypeScript twin agrees', () => {
    for (const bucket of Object.values(ReturnBucket)) {
      const actionable = ACTIONABLE_RETURN_BUCKETS.includes(bucket);
      expect(scopeReturnBucketToStore(bucket, true)).toBe(bucket);
      expect(scopeReturnBucketToStore(bucket, false)).toBe(actionable ? ReturnBucket.UNCONFIRMED : bucket);
    }
  });
});

describe('EbayReturnsService.counts', () => {
  it('returns every bucket, zero-filled', async () => {
    const { service, query } = build({ counts: [] });

    await expect(service.counts(USER)).resolves.toEqual({
      [ReturnBucket.UNCONFIRMED]: 0,
      [ReturnBucket.ACTION_OVERDUE]: 0,
      [ReturnBucket.ACTION_DUE]: 0,
      [ReturnBucket.ESCALATED]: 0,
      [ReturnBucket.IN_PROGRESS]: 0,
      [ReturnBucket.CLOSED]: 0,
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain(`SELECT ${BUCKET_SQL} AS bucket`);
    expect(sql).toContain('WHERE r.user_id = $1');
    expect(params).toEqual([USER]);
  });

  it('fills in what the database counted and ignores a bucket it does not know', async () => {
    const { service } = build({
      counts: [
        { bucket: ReturnBucket.ACTION_DUE, count: 3 },
        { bucket: ReturnBucket.CLOSED, count: '12' },
        { bucket: 'made_up', count: 99 },
      ],
    });

    const counts = await service.counts(USER);

    expect(counts).toEqual({
      [ReturnBucket.UNCONFIRMED]: 0,
      [ReturnBucket.ACTION_OVERDUE]: 0,
      [ReturnBucket.ACTION_DUE]: 3,
      [ReturnBucket.ESCALATED]: 0,
      [ReturnBucket.IN_PROGRESS]: 0,
      [ReturnBucket.CLOSED]: 12,
    });
    expect(Object.keys(counts).sort()).toEqual(Object.values(ReturnBucket).sort());
  });

  it('narrows to one store when asked', async () => {
    const { service, query } = build();

    await service.counts(USER, { ebayAccountId: ACCOUNT });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE r.user_id = $1 AND r.ebay_account_id = $2::uuid');
    expect(params).toEqual([USER, ACCOUNT]);
  });
});

describe('EbayReturnsService freshness', () => {
  it('reports a row eBay has not confirmed within the horizon as UNCONFIRMED', async () => {
    const { service } = build({
      total: 1,
      rows: [dbRow({ last_synced_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) })],
    });

    const page = await service.list(USER);

    expect(page.items[0].bucket).toBe(ReturnBucket.UNCONFIRMED);
  });

  it('keeps the same row actionable when the sweep interval makes the horizon longer', async () => {
    // Interval 48 h → horizon 96 h; three days old is still inside it.
    const { service, query } = build({
      total: 1,
      intervalHours: 48,
      rows: [dbRow({ last_synced_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) })],
    });

    const page = await service.list(USER, { tab: ReturnTab.ACTION });

    expect(page.items[0].bucket).toBe(ReturnBucket.ACTION_DUE);
    // …and the SQL filtered with the very same horizon the DTO was derived with.
    expect(query.mock.calls[0][0]).toContain("INTERVAL '96 hours'");
    expect(query.mock.calls[1][0]).toContain("INTERVAL '96 hours'");
  });

  it('counts with the horizon of the current sweep interval', async () => {
    const { service, query } = build({ intervalHours: 24 });

    await service.counts(USER);

    expect(query.mock.calls[0][0]).toContain("INTERVAL '48 hours'");
  });
});
