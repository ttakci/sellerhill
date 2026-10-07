// apps/api/src/modules/ebay-returns/ebay-cancellations-actions.service.spec.ts

import { Logger } from '@nestjs/common';
import { CancellationBucket, EbayCancellationAction, PlatformSettingKey } from '@repo/shared';

import {
  buildRejectCancelBody,
  CancellationActionError,
  EbayCancellationsActionsService,
} from './ebay-cancellations-actions.service';
import { PostOrderRejectedError } from './post-order.client';

const USER = '00000000-0000-4000-8000-00000000000a';
const ID = '33333333-3333-4333-8333-333333333333';
const ACCOUNT = '11111111-1111-4111-8111-11111111111a';
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

type QueryMock = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

function build(
  options: {
    enabled?: boolean;
    suspended?: boolean;
    sandbox?: boolean;
    live?: Record<string, unknown>;
    tracking?: { number: string | null; at: Date | null };
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
    expect(order).toEqual(['row', 'switch', 'suspended', 'sandbox', 'live', 'write', 'live']);
  });

  it('refuses everything while the operator switch is off, before touching eBay', async () => {
    const { service, postOrder } = build({ enabled: false });
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({
      key: 'orders.cancellation.errors.actionsDisabled',
      status: 409,
    });
    expect(postOrder.getCancellation).not.toHaveBeenCalled();
    expect(postOrder.approveCancellation).not.toHaveBeenCalled();
  });

  it('refuses a suspended account and a Sandbox deployment', async () => {
    await expect(build({ suspended: true }).service.act(USER, ID, EbayCancellationAction.REJECT)).rejects.toMatchObject({
      key: 'orders.cancellation.errors.suspended',
    });
    await expect(build({ sandbox: true }).service.act(USER, ID, EbayCancellationAction.REJECT)).rejects.toMatchObject({
      key: 'orders.cancellation.errors.sandbox',
    });
  });

  it.each([
    ['the seller’s own request', detail({ requestorType: 'SELLER' })],
    ['a closed request', detail({ cancelCloseDate: { value: '2026-10-07T09:00:00.000Z' } })],
    ['no seller response due', detail({ sellerResponseDueDate: undefined })],
  ])('refuses to answer %s (LIVE read), with no write', async (_label, live) => {
    const { service, postOrder } = build({ live });
    await expect(service.act(USER, ID, EbayCancellationAction.APPROVE)).rejects.toMatchObject({
      key: 'orders.cancellation.errors.actionNotAvailable',
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
      key: 'orders.cancellation.errors.ebayRejected',
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
    expect(error).toMatchObject({ key: 'orders.cancellation.errors.notFound', status: 404 });
  });
});

describe('EbayCancellationsActionsService.list', () => {
  it('reads the caller’s BUYER requests, paged, and offers answers only on an action bucket with the switch on', async () => {
    const { service, query } = build();
    query.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ count: '1' }]);
      }
      return Promise.resolve([
        {
          id: ID,
          cancel_id: '5000000123',
          ebay_account_id: ACCOUNT,
          legacy_order_id: '12-34567-89012',
          order_id: null,
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
        },
      ]);
    });
    const page = await service.list(USER, { actionOnly: true });
    expect(page).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(page.items[0]).toMatchObject({
      cancelId: '5000000123',
      orderId: null,
      bucket: CancellationBucket.ACTION_DUE,
      requestedRefundAmount: 41.9,
      sellerRespondBy: '2026-10-09T10:00:00.000Z',
      actionsEnabled: true,
      availableActions: [EbayCancellationAction.APPROVE, EbayCancellationAction.REJECT],
    });
    const [sql, params] = query.mock.calls[query.mock.calls.length - 1];
    expect(sql).toContain('WHERE c.user_id = $1 AND c.requestor_type = $2');
    expect(params?.slice(0, 2)).toEqual([USER, 'BUYER']);
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
});
