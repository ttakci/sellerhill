// apps/api/src/modules/ebay-returns/ebay-cancellations-actions.service.spec.ts

import { Logger } from '@nestjs/common';
import {
  CancellationBucket,
  CancellationTab,
  EbayCancellationAction,
  PlatformSettingKey,
  resolveReturnFreshnessHours,
} from '@repo/shared';

import {
  buildRejectCancelBody,
  CancellationActionError,
  EbayCancellationsActionsService,
} from './ebay-cancellations-actions.service';
import { PostOrderRejectedError } from './post-order.client';
import { buildStoreScopedCancellationBucketSql } from './return-store-scope';

const USER = '00000000-0000-4000-8000-00000000000a';
const ID = '33333333-3333-4333-8333-333333333333';
const ACCOUNT = '11111111-1111-4111-8111-11111111111a';
const ORDER = '44444444-4444-4444-8444-444444444444';
const SHIPPED_AT = new Date('2026-10-06T15:00:00.000Z');

/** A live `cancelDetail`: the buyer's open request, awaiting the seller. */
const detail = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  cancelId: '5000000123',
  requestorType: 'BUYER',
  cancelState: 'REFUND_PENDING',
  cancelStatus: 'CANCEL_PENDING',
  sellerResponseDueDate: { value: '2026-10-09T10:00:00.000Z' },
  ...over,
});

/** A stored `ebay_cancellations` row as the list / detail SELECT returns it, linked to an order with a listing. */
const storedRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ID,
  cancel_id: '5000000123',
  ebay_account_id: ACCOUNT,
  legacy_order_id: '12-34567-89012',
  order_id: ORDER,
  bucket: CancellationBucket.ACTION_DUE,
  state: 'REFUND_PENDING',
  status: 'CANCEL_PENDING',
  reason: 'BUYER_ASKED_CANCEL',
  close_reason: null,
  requestor_type: 'BUYER',
  buyer_login_name: 'a_buyer',
  requested_at: new Date('2026-10-06T10:00:00.000Z'),
  seller_respond_by: new Date('2026-10-09T10:00:00.000Z'),
  closed_at: null,
  requested_refund_amount: '41.90',
  currency: 'USD',
  last_synced_at: new Date('2026-10-07T10:00:00.000Z'),
  listing_id: '55555555-5555-4555-8555-555555555555',
  listing_title: 'Desk lamp',
  listing_asin: 'B000000001',
  product_image_urls: ['https://img.example/lamp.jpg'],
  ...over,
});

type QueryMock = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

function build(
  options: {
    enabled?: boolean;
    suspended?: boolean;
    sandbox?: boolean;
    live?: Record<string, unknown>;
    tracking?: { number: string | null; at: Date | null };
    /** The stored row the detail reads; null = not the caller's. */
    stored?: Record<string, unknown> | null;
    /** false = the row was already answered (the compare-and-set claims nothing). */
    claimable?: boolean;
  } = {}
) {
  const order: string[] = [];
  const query: QueryMock = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) => {
    if (sql.includes('JOIN ebay_accounts ea')) {
      order.push('row');
      return Promise.resolve([
        {
          id: ID,
          cancel_id: '5000000123',
          ebay_account_id: ACCOUNT,
          marketplace_id: 'EBAY_US',
          ebay_tracking_pushed_number: options.tracking?.number ?? null,
          ebay_tracking_pushed_at: options.tracking?.at ?? null,
        },
      ]);
    }
    if (sql.includes('SET seller_answered_at = NOW()')) {
      order.push('claim');
      return Promise.resolve(options.claimable === false ? [] : [{ id: ID }]);
    }
    if (sql.includes('SET seller_answered_at = NULL')) {
      order.push('release');
      return Promise.resolve([]);
    }
    if (sql.includes('LEFT JOIN listings l')) {
      const stored = options.stored === undefined ? storedRow() : options.stored;
      return Promise.resolve(stored ? [stored] : []);
    }
    return Promise.resolve([]);
  });
  const getBoolean = jest.fn((key: PlatformSettingKey) => {
    order.push('switch');
    return Promise.resolve(key === PlatformSettingKey.EBAY_CANCELLATIONS_ACTIONS_ENABLED ? (options.enabled ?? true) : false);
  });
  const isSuspended = jest.fn(() => {
    order.push('suspended');
    return Promise.resolve(options.suspended ?? false);
  });
  const postOrder = {
    isReturnSearchSupported: jest.fn(() => {
      order.push('sandbox');
      return !(options.sandbox ?? false);
    }),
    getCancellation: jest.fn(() => {
      order.push('live');
      return Promise.resolve(options.live ?? detail());
    }),
    approveCancellation: jest.fn(() => {
      order.push('write');
      return Promise.resolve();
    }),
    rejectCancellation: jest.fn(() => {
      order.push('write');
      return Promise.resolve();
    }),
  };
  const sync = { upsertCancellation: jest.fn(() => Promise.resolve()) };
  const service = new EbayCancellationsActionsService(
    { query } as never,
    { getBoolean } as never,
    { isSuspended } as never,
    { getAccountAccessToken: jest.fn(() => Promise.resolve('tok')) } as never,
    postOrder as never,
    sync as never,
    { resolveCancellations: jest.fn(() => Promise.resolve({ intervalHours: 6 })) } as never
  );
  return { service, query, postOrder, sync, order };
}

const audits = (query: QueryMock): Array<[string, unknown[]?]> =>
  query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO audit_logs'));

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('EbayCancellationsActionsService.act', () => {
  it('checks the gates in order: row → switch → suspension → sandbox → live read → one write', async () => {
    const { service, order } = build();
    await service.act(USER, ID, EbayCancellationAction.APPROVE);
    // The re-read after the write adds a second `live`.
    expect(order).toEqual(['row', 'switch', 'suspended', 'sandbox', 'live', 'claim', 'write', 'live']);
  });

  it('refuses everything while the operator switch is off, before touching eBay', async () => {
    const { service, postOrder } = build({ enabled: false });
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({
      key: 'cancellations.errors.actionsDisabled',
      status: 409,
    });
    expect(postOrder.getCancellation).not.toHaveBeenCalled();
    expect(postOrder.approveCancellation).not.toHaveBeenCalled();
  });

  it('refuses a suspended account and a Sandbox deployment', async () => {
    await expect(build({ suspended: true }).service.act(USER, ID, EbayCancellationAction.REJECT)).rejects.toMatchObject({
      key: 'cancellations.errors.suspended',
    });
    await expect(build({ sandbox: true }).service.act(USER, ID, EbayCancellationAction.REJECT)).rejects.toMatchObject({
      key: 'cancellations.errors.sandbox',
    });
  });

  it.each([
    ['the seller’s own request', detail({ requestorType: 'SELLER' })],
    ['a closed request', detail({ cancelCloseDate: { value: '2026-10-07T09:00:00.000Z' } })],
    ['no seller response due', detail({ sellerResponseDueDate: undefined })],
  ])('refuses to answer %s (LIVE read), with no write', async (_label, live) => {
    const { service, postOrder } = build({ live });
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({
      key: 'cancellations.errors.actionNotAvailable',
      status: 409,
    });
    expect(postOrder.approveCancellation).not.toHaveBeenCalled();
  });

  it('approves with no body, audits it and re-reads the request into the row', async () => {
    const { service, query, postOrder, sync } = build();
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).resolves.toEqual({
      action: EbayCancellationAction.APPROVE,
    });
    expect(postOrder.approveCancellation).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000123');
    expect(audits(query)).toHaveLength(1);
    expect(audits(query)[0][0]).toContain("'EBAY_CANCELLATION_ACTION', 'ebay_cancellation'");
    expect(String(audits(query)[0][1]?.[2])).toContain('"outcome":"sent"');
    expect(sync.upsertCancellation).toHaveBeenCalledWith(
      { id: ACCOUNT, user_id: USER },
      expect.objectContaining({ cancelId: '5000000123' })
    );
  });

  it('rejects with `{}` when the order has no pushed shipment', async () => {
    const { service, postOrder } = build();
    await service.act(USER, ID, EbayCancellationAction.REJECT);
    expect(postOrder.rejectCancellation).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000123', {});
  });

  it('rejects with the pushed tracking number and its date when the order shipped', async () => {
    const { service, postOrder, query } = build({ tracking: { number: '9400111899223', at: SHIPPED_AT } });
    await service.act(USER, ID, EbayCancellationAction.REJECT);
    expect(postOrder.rejectCancellation).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000123', {
      shipmentDate: { value: '2026-10-06T15:00:00.000Z' },
      trackingNumber: '9400111899223',
    });
    expect(String(audits(query)[0][1]?.[2])).toContain('"withTracking":true');
  });

  it('reports eBay’s refusal as a 409 with its own key, and still audits it', async () => {
    const { service, query, postOrder, sync } = build();
    postOrder.approveCancellation.mockRejectedValueOnce(new PostOrderRejectedError('no', 400));
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({
      key: 'cancellations.errors.ebayRejected',
      status: 409,
    });
    expect(String(audits(query)[0][1]?.[2])).toContain('"outcome":"rejected"');
    expect(sync.upsertCancellation).not.toHaveBeenCalled();
  });

  it('maps a transport failure to 503 and a missing row to 404', async () => {
    const failing = build();
    failing.postOrder.approveCancellation.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(failing.service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({ status: 503 });

    const missing = build();
    missing.query.mockResolvedValue([]);
    const error = await missing.service.act(USER, ID, EbayCancellationAction.APPROVE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CancellationActionError);
    expect(error).toMatchObject({ key: 'cancellations.errors.notFound', status: 404 });
  });
});

describe('EbayCancellationsActionsService.list', () => {
  it('reads the caller’s BUYER requests, paged, and offers answers only on an action bucket', async () => {
    const { service, query } = build();
    query.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('COUNT(*)') ? [{ count: 1 }] : [storedRow({ order_id: null, listing_id: null })])
    );
    const page = await service.list(USER, { tab: CancellationTab.ACTION });
    expect(page).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(page.items[0]).toMatchObject({
      cancelId: '5000000123',
      orderId: null,
      bucket: CancellationBucket.ACTION_DUE,
      requestedRefundAmount: 41.9,
      sellerRespondBy: '2026-10-09T10:00:00.000Z',
      actionsEnabled: true,
      availableActions: [EbayCancellationAction.APPROVE, EbayCancellationAction.REJECT],
      product: null,
    });
    const [sql, params] = query.mock.calls[query.mock.calls.length - 1];
    expect(sql).toContain('WHERE c.user_id = $1 AND c.requestor_type = $2 AND');
    expect(sql).toContain('= ANY($3::text[])');
    expect(params?.slice(0, 3)).toEqual([USER, 'BUYER', [CancellationBucket.ACTION_OVERDUE, CancellationBucket.ACTION_DUE]]);
  });

  it('filters by store, order and search (cancel id, eBay order id, product title) and joins the product', async () => {
    const { service, query } = build();
    query.mockImplementation((sql: string) => Promise.resolve(sql.includes('COUNT(*)') ? [{ count: 1 }] : [storedRow()]));
    const page = await service.list(USER, {
      tab: CancellationTab.ALL,
      ebayAccountId: ACCOUNT,
      orderId: ORDER,
      search: ' 50%_ ',
      page: 2,
      limit: 5,
    });
    expect(page.items[0].product).toEqual({
      title: 'Desk lamp',
      imageUrl: 'https://img.example/lamp.jpg',
      asin: 'B000000001',
      ebayItemId: null,
    });
    const [countSql, countParams] = query.mock.calls.find(([q]) => q.includes('COUNT(*)')) ?? [''];
    expect(countSql).toContain('LEFT JOIN listings l ON l.id = o.listing_id');
    expect(countSql).toContain('c.ebay_account_id = $3::uuid AND c.order_id = $4::uuid');
    expect(countSql).toContain('(c.cancel_id ILIKE $5 OR c.legacy_order_id ILIKE $5 OR l.title ILIKE $5)');
    expect(countSql).not.toContain('::text[])');
    expect(countParams).toEqual([USER, 'BUYER', ACCOUNT, ORDER, '%50\\%\\_%']);
    const [, pageParams] = query.mock.calls[query.mock.calls.length - 1];
    expect(pageParams?.slice(-2)).toEqual([5, 5]);
  });
});

describe('EbayCancellationsActionsService.counts', () => {
  it('groups the caller’s BUYER requests by the store-scoped bucket, zero-filled, store-filtered', async () => {
    const { service, query } = build();
    query.mockResolvedValue([
      { bucket: CancellationBucket.ACTION_OVERDUE, count: 2 },
      { bucket: CancellationBucket.CLOSED, count: '7' },
      { bucket: 'not_a_bucket', count: 9 },
    ]);
    await expect(service.counts(USER, { ebayAccountId: ACCOUNT })).resolves.toEqual({
      [CancellationBucket.UNCONFIRMED]: 0,
      [CancellationBucket.ACTION_OVERDUE]: 2,
      [CancellationBucket.ACTION_DUE]: 0,
      [CancellationBucket.ANSWERED]: 0,
      [CancellationBucket.IN_PROGRESS]: 0,
      [CancellationBucket.CLOSED]: 7,
    });
    const [sql, params] = query.mock.calls[0];
    const bucket = buildStoreScopedCancellationBucketSql('c', resolveReturnFreshnessHours(6));
    expect(sql).toContain(`SELECT ${bucket} AS bucket, COUNT(*)::int AS count`);
    expect(sql).toContain('FROM ebay_cancellations c');
    expect(sql).toContain('WHERE c.user_id = $1 AND c.requestor_type = $2 AND c.ebay_account_id = $3::uuid');
    expect(sql).toContain('GROUP BY 1');
    expect(params).toEqual([USER, 'BUYER', ACCOUNT]);
  });

  it('counts every store without a filter', async () => {
    const { service, query } = build();
    await service.counts(USER);
    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toContain('ebay_account_id = $3');
    expect(params).toEqual([USER, 'BUYER']);
  });
});

describe('EbayCancellationsActionsService.detail', () => {
  /** A live `cancelDetail` with the parts only the detail read carries. */
  const fullDetail = (over: Record<string, unknown> = {}): Record<string, unknown> =>
    detail({
      requestRefundAmount: { value: 13.65, currency: 'USD' },
      paymentStatus: 'PAID',
      activityHistories: [
        { actionDate: { value: '2026-10-06T10:00:00.000Z' }, activityParty: 'BUYER', activityType: 'BUYER_CREATE_CANCEL' },
      ],
      refundInfo: { actualRefundDetail: { actualRefund: { totalAmount: { value: 13.65, currency: 'USD' } } } },
      payoutRecoupInfo: { amountToRecoup: { value: 11.4, currency: 'USD' } },
      ...over,
    });

  it('overlays the stored row with ONE live read and offers the answers the live request allows', async () => {
    const { service, postOrder } = build({ live: fullDetail() });
    const dto = await service.detail(USER, ID);
    expect(dto).toMatchObject({
      id: ID,
      live: true,
      bucket: CancellationBucket.ACTION_DUE,
      requestedRefundAmount: 13.65,
      actualRefundAmount: 13.65,
      amountToRecoup: 11.4,
      paymentStatus: 'PAID',
      buyerLoginName: 'a_buyer',
      availableActions: [EbayCancellationAction.APPROVE, EbayCancellationAction.REJECT],
      ebayUrl: 'https://www.ebay.com/Cancel/Details?cancelId=5000000123',
      product: { title: 'Desk lamp', imageUrl: 'https://img.example/lamp.jpg', asin: 'B000000001' },
    });
    expect(dto.history).toEqual([
      { activity: 'BUYER_CREATE_CANCEL', party: 'BUYER', at: '2026-10-06T10:00:00.000Z', fromState: null, toState: null },
    ]);
    expect(postOrder.getCancellation).toHaveBeenCalledTimes(1);
  });

  it('reuses the live read for 60 s, but an answer always reads eBay afresh', async () => {
    const { service, postOrder } = build({ live: fullDetail() });
    await service.detail(USER, ID);
    await service.detail(USER, ID);
    expect(postOrder.getCancellation).toHaveBeenCalledTimes(1);
    await service.act(USER, ID, EbayCancellationAction.APPROVE);
    // act: the fresh read before the write + the re-read after it.
    expect(postOrder.getCancellation).toHaveBeenCalledTimes(3);
  });

  it('offers nothing when the live request no longer awaits the seller, or the switch is off', async () => {
    const closed = await build({
      live: fullDetail({ cancelCloseDate: { value: '2026-10-07T09:00:00.000Z' }, sellerResponseDueDate: undefined }),
    }).service.detail(USER, ID);
    expect(closed).toMatchObject({ live: true, bucket: CancellationBucket.CLOSED, availableActions: [] });

    const off = await build({ enabled: false, live: fullDetail() }).service.detail(USER, ID);
    expect(off).toMatchObject({ live: true, actionsEnabled: false, availableActions: [] });
  });

  it('falls back to the stored row, live:false and no answer, when eBay cannot be read', async () => {
    const { service, postOrder } = build();
    postOrder.getCancellation.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.detail(USER, ID)).resolves.toMatchObject({
      live: false,
      bucket: CancellationBucket.ACTION_DUE,
      requestedRefundAmount: 41.9,
      availableActions: [],
      history: [],
      actualRefundAmount: null,
      amountToRecoup: null,
      ebayUrl: 'https://www.ebay.com/Cancel/Details?cancelId=5000000123',
    });
  });

  it('never calls eBay from a Sandbox deployment, and 404s a row that is not the caller’s', async () => {
    const sandbox = build({ sandbox: true });
    await expect(sandbox.service.detail(USER, ID)).resolves.toMatchObject({
      live: false,
      ebayUrl: 'https://www.sandbox.ebay.com/Cancel/Details?cancelId=5000000123',
    });
    expect(sandbox.postOrder.getCancellation).not.toHaveBeenCalled();

    await expect(build({ stored: null }).service.detail(USER, ID)).rejects.toMatchObject({
      key: 'cancellations.errors.notFound',
      status: 404,
    });
  });
});

describe('buildRejectCancelBody', () => {
  it('is `{}` unless both the tracking number and its date exist', () => {
    expect(buildRejectCancelBody({ ebay_tracking_pushed_number: null, ebay_tracking_pushed_at: SHIPPED_AT })).toEqual({});
    expect(buildRejectCancelBody({ ebay_tracking_pushed_number: '  ', ebay_tracking_pushed_at: SHIPPED_AT })).toEqual({});
    expect(buildRejectCancelBody({ ebay_tracking_pushed_number: '1Z999', ebay_tracking_pushed_at: null })).toEqual({});
    expect(buildRejectCancelBody({ ebay_tracking_pushed_number: '1Z999', ebay_tracking_pushed_at: SHIPPED_AT })).toEqual({
      shipmentDate: { value: SHIPPED_AT.toISOString() },
      trackingNumber: '1Z999',
    });
  });

  it('sends what the seller typed on the decline form before the pushed shipment', () => {
    const pushed = { ebay_tracking_pushed_number: '1Z999', ebay_tracking_pushed_at: SHIPPED_AT };
    const now = new Date('2026-10-07T09:30:00.000Z');
    // eBay format (reference sample: 2022-03-20T00:00:00.000Z); the picked day at 12:00 UTC.
    expect(buildRejectCancelBody(pushed, { shipmentDate: '2026-10-05', trackingNumber: ' AQUA123 ' }, now)).toEqual({
      shipmentDate: { value: '2026-10-05T12:00:00.000Z' },
      trackingNumber: 'AQUA123',
    });
    // Each field is optional on eBay's side, so one alone is sent alone.
    expect(buildRejectCancelBody(pushed, { trackingNumber: 'AQUA123' })).toEqual({ trackingNumber: 'AQUA123' });
    expect(buildRejectCancelBody(pushed, { shipmentDate: '2026-10-05' }, now)).toEqual({
      shipmentDate: { value: '2026-10-05T12:00:00.000Z' },
    });
    // Today (or a future day) is never sent later than now.
    expect(buildRejectCancelBody(pushed, { shipmentDate: '2026-10-07' }, now)).toEqual({
      shipmentDate: { value: '2026-10-07T09:30:00.000Z' },
    });
    // A malformed date and a blank number count as not entered.
    expect(buildRejectCancelBody(pushed, { shipmentDate: '05.10.2026', trackingNumber: '  ' })).toEqual({
      shipmentDate: { value: SHIPPED_AT.toISOString() },
      trackingNumber: '1Z999',
    });
  });
});

describe('EbayCancellationsActionsService — an answered request', () => {
  it('refuses a second answer without calling eBay when the row is already claimed', async () => {
    const { service, postOrder } = build({ claimable: false });
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({
      key: 'cancellations.errors.actionNotAvailable',
      status: 409,
    });
    expect(postOrder.approveCancellation).not.toHaveBeenCalled();
  });

  it('refuses when eBay already shows a seller step, even with the due date still set', async () => {
    const live = {
      ...detail(),
      activityHistories: [
        { activityType: 'BUYER_CREATE_CANCEL', activityParty: 'BUYER' },
        { activityType: 'SELLER_APPROVE', activityParty: 'SELLER' },
      ],
    };
    const { service, postOrder, order } = build({ live });
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({ status: 409 });
    expect(postOrder.approveCancellation).not.toHaveBeenCalled();
    expect(order).not.toContain('claim');
  });

  it('releases the claim when eBay refuses the answer, so the seller can answer again', async () => {
    const { service, postOrder, order } = build();
    postOrder.approveCancellation.mockImplementationOnce(() => Promise.reject(new PostOrderRejectedError('refused', 400)));
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({ status: 409 });
    expect(order.indexOf('release')).toBeGreaterThan(order.indexOf('claim'));
  });

  it('reads as ANSWERED with no action offered once the seller answered from SellerHill', async () => {
    const { service } = build({
      stored: storedRow({ seller_answered_at: new Date('2026-10-07T18:35:48.000Z'), seller_answer: 'approve' }),
    });
    await expect(service.detail(USER, ID)).resolves.toMatchObject({
      bucket: CancellationBucket.ANSWERED,
      sellerAnswer: EbayCancellationAction.APPROVE,
      availableActions: [],
    });
  });
});
