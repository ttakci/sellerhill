// apps/api/src/modules/orders/ebay-order-changes.spec.ts

import * as fs from 'fs';
import * as path from 'path';

import { AutoFulfillStatus, OrderStatus } from '@repo/shared';

import {
  buildSyncedStatusSql,
  decideIngest,
  FRESH_SALE_WINDOW_DAYS,
  initialAutoFulfillStatus,
  mergeSyncedOrderStatus,
  readCancellation,
  readRefunds,
} from './ebay-order-changes';

const DAY_MS = 86_400_000;

describe('readCancellation', () => {
  it('reads a cancelled order from cancelledDate', () => {
    const result = readCancellation({ cancelState: 'CANCELED', cancelledDate: '2026-09-20T10:00:00.000Z' });
    expect(result.isCancelled).toBe(true);
    expect(result.cancelState).toBe('CANCELED');
    expect(result.cancelledAt?.toISOString()).toBe('2026-09-20T10:00:00.000Z');
  });

  it('is not cancelled when nobody asked to cancel', () => {
    expect(readCancellation({ cancelState: 'NONE_REQUESTED' })).toEqual({
      cancelState: 'NONE_REQUESTED',
      cancelledAt: null,
      isCancelled: false,
      cancelRequestCount: 0,
    });
  });

  it('counts the cancel requests a single-order read carries (getOrders always sends none)', () => {
    expect(readCancellation({ cancelState: 'IN_PROGRESS', cancelRequests: [{}, {}] }).cancelRequestCount).toBe(2);
    expect(readCancellation({ cancelState: 'NONE_REQUESTED', cancelRequests: [] }).cancelRequestCount).toBe(0);
    expect(readCancellation(undefined).cancelRequestCount).toBe(0);
    // A request is still not a cancellation.
    expect(readCancellation({ cancelState: 'IN_PROGRESS', cancelRequests: [{}] }).isCancelled).toBe(false);
  });

  it('never reads a state it does not know as a cancellation', () => {
    // A cancel REQUEST is not a cancellation: only cancelledDate (documented) or
    // the observed terminal state void the sale.
    expect(readCancellation({ cancelState: 'IN_PROGRESS' }).isCancelled).toBe(false);
    expect(readCancellation({ cancelState: 'SOMETHING_NEW' }).isCancelled).toBe(false);
  });

  it('survives a missing block and an unparseable date', () => {
    expect(readCancellation(undefined).isCancelled).toBe(false);
    expect(readCancellation(null).cancelState).toBeNull();
    expect(readCancellation({ cancelledDate: 'not a date' }).cancelledAt).toBeNull();
  });
});

describe('readRefunds', () => {
  it('reports nothing for an empty array', () => {
    expect(readRefunds([])).toEqual({ refundedAmount: null, refundedAt: null });
    expect(readRefunds(undefined)).toEqual({ refundedAmount: null, refundedAt: null });
  });

  it('sums issued refunds and keeps the latest date', () => {
    const result = readRefunds([
      { amount: { value: '10.10', currency: 'USD' }, refundDate: '2026-09-10T00:00:00.000Z' },
      { amount: { value: '5.25', currency: 'USD' }, refundDate: '2026-09-12T00:00:00.000Z' },
    ]);
    expect(result.refundedAmount).toBe(15.35);
    expect(result.refundedAt?.toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });

  it('ignores a refund that has not been issued yet (no refundDate)', () => {
    const result = readRefunds([
      { amount: { value: '20.00' }, refundStatus: 'PENDING' },
      { amount: { value: '4.00' }, refundDate: '2026-09-12T00:00:00.000Z' },
    ]);
    expect(result.refundedAmount).toBe(4);
  });

  it('keeps a real zero apart from "no refund"', () => {
    expect(readRefunds([{ amount: { value: '0.00' }, refundDate: '2026-09-12T00:00:00.000Z' }]).refundedAmount).toBe(0);
  });

  it('skips an unreadable amount', () => {
    expect(readRefunds([{ amount: { value: 'abc' }, refundDate: '2026-09-12T00:00:00.000Z' }])).toEqual({
      refundedAmount: null,
      refundedAt: null,
    });
  });
});

describe('mergeSyncedOrderStatus', () => {
  const all = Object.values(OrderStatus);

  it('takes the incoming status for a new order', () => {
    for (const incoming of all) {
      expect(mergeSyncedOrderStatus(null, incoming)).toBe(incoming);
    }
  });

  it('a cancellation wins over anything', () => {
    for (const current of all) {
      expect(mergeSyncedOrderStatus(current, OrderStatus.CANCELLED)).toBe(OrderStatus.CANCELLED);
    }
  });

  it('a cancelled order stays cancelled', () => {
    for (const incoming of all) {
      expect(mergeSyncedOrderStatus(OrderStatus.CANCELLED, incoming)).toBe(OrderStatus.CANCELLED);
    }
  });

  it('never rewinds what we advanced ourselves', () => {
    // eBay still says NOT_STARTED + PAID while we hold "delivered".
    expect(mergeSyncedOrderStatus(OrderStatus.COMPLETED, OrderStatus.WAITING_SHIPMENT)).toBe(OrderStatus.COMPLETED);
    expect(mergeSyncedOrderStatus(OrderStatus.COMPLETED, OrderStatus.SHIPPED)).toBe(OrderStatus.COMPLETED);
    expect(mergeSyncedOrderStatus(OrderStatus.SHIPPED, OrderStatus.WAITING_SHIPMENT)).toBe(OrderStatus.SHIPPED);
    expect(mergeSyncedOrderStatus(OrderStatus.WAITING_SHIPMENT, OrderStatus.PENDING)).toBe(
      OrderStatus.WAITING_SHIPMENT
    );
  });

  it('moves forward', () => {
    expect(mergeSyncedOrderStatus(OrderStatus.PENDING, OrderStatus.WAITING_SHIPMENT)).toBe(
      OrderStatus.WAITING_SHIPMENT
    );
    expect(mergeSyncedOrderStatus(OrderStatus.WAITING_SHIPMENT, OrderStatus.SHIPPED)).toBe(OrderStatus.SHIPPED);
    expect(mergeSyncedOrderStatus(OrderStatus.WAITING_SHIPMENT, OrderStatus.PROCESSING)).toBe(OrderStatus.PROCESSING);
  });
});

/**
 * The SQL twin is interpreted here rather than trusted: the two rank CASEs and
 * the four WHEN arms are evaluated for every (current, incoming) pair and
 * compared with the TypeScript.
 */
describe('buildSyncedStatusSql', () => {
  const sql = buildSyncedStatusSql();

  const rankOf = (column: string, value: OrderStatus): number => {
    const match = new RegExp(`CASE ${column.replace('.', '\\.')}::text (.+?) ELSE 0 END`).exec(sql);
    if (!match) {
      throw new Error(`rank CASE for ${column} not found`);
    }
    const arm = new RegExp(`WHEN '${value}' THEN (\\d+)`).exec(match[1]);
    return arm ? Number(arm[1]) : 0;
  };

  const evaluate = (current: OrderStatus, incoming: OrderStatus): OrderStatus => {
    if (incoming === OrderStatus.CANCELLED) {
      return incoming;
    }
    if (current === OrderStatus.CANCELLED) {
      return current;
    }
    return rankOf('EXCLUDED.status', incoming) >= rankOf('orders.status', current) ? incoming : current;
  };

  it('has the four arms in the documented order', () => {
    const arms = sql
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('WHEN') || line.startsWith('ELSE'));
    expect(arms).toHaveLength(4);
    expect(arms[0]).toBe(`WHEN EXCLUDED.status::text = '${OrderStatus.CANCELLED}' THEN EXCLUDED.status`);
    expect(arms[1]).toBe(`WHEN orders.status::text = '${OrderStatus.CANCELLED}' THEN orders.status`);
    expect(arms[2]).toMatch(/^WHEN \(CASE EXCLUDED\.status::text .+\) >= \(CASE orders\.status::text .+\) THEN EXCLUDED\.status$/);
    expect(arms[3]).toBe('ELSE orders.status');
  });

  it('agrees with mergeSyncedOrderStatus on every pair', () => {
    for (const current of Object.values(OrderStatus)) {
      for (const incoming of Object.values(OrderStatus)) {
        expect(`${current}->${incoming}: ${evaluate(current, incoming)}`).toBe(
          `${current}->${incoming}: ${mergeSyncedOrderStatus(current, incoming)}`
        );
      }
    }
  });

  it('ranks every status', () => {
    for (const status of Object.values(OrderStatus)) {
      expect(sql).toContain(`WHEN '${status}' THEN`);
    }
  });
});

describe('decideIngest', () => {
  const connectedAt = new Date('2026-09-01T00:00:00.000Z');
  const now = new Date('2026-09-30T00:00:00.000Z');

  it('admits and automates a recent sale made after the store was connected', () => {
    const decision = decideIngest({
      orderCreatedAt: new Date(now.getTime() - DAY_MS),
      storeConnectedAt: connectedAt,
      now,
    });
    expect(decision.mayInsert).toBe(true);
    expect(decision.isFreshSale(true)).toBe(true);
  });

  it('never automates an order that was already held', () => {
    const decision = decideIngest({
      orderCreatedAt: new Date(now.getTime() - DAY_MS),
      storeConnectedAt: connectedAt,
      now,
    });
    expect(decision.isFreshSale(false)).toBe(false);
  });

  it('refuses an order from before the store was connected', () => {
    const decision = decideIngest({
      orderCreatedAt: new Date('2026-08-15T00:00:00.000Z'),
      storeConnectedAt: connectedAt,
      now,
    });
    expect(decision.mayInsert).toBe(false);
    expect(decision.isFreshSale(true)).toBe(false);
  });

  it('records a late-discovered order without acting on it', () => {
    const decision = decideIngest({
      orderCreatedAt: new Date(now.getTime() - (FRESH_SALE_WINDOW_DAYS + 1) * DAY_MS),
      storeConnectedAt: connectedAt,
      now,
    });
    expect(decision.mayInsert).toBe(true);
    expect(decision.isFreshSale(true)).toBe(false);
  });

  it('fails closed on an order with no creation date', () => {
    const decision = decideIngest({ orderCreatedAt: null, storeConnectedAt: connectedAt, now });
    expect(decision.mayInsert).toBe(false);
    expect(decision.isFreshSale(true)).toBe(false);
  });
});

describe('initialAutoFulfillStatus', () => {
  // `pending` reads as "buying on Amazon". A new row may start there only when
  // the purchase gate is about to run for it — every other row would say
  // "buying" for ever with no job behind it (15 such rows on the first store).
  it('starts at pending only for a fresh, tracked sale with a quantity', () => {
    expect(initialAutoFulfillStatus({ freshIfInserted: true, hasListing: true, quantity: 1 })).toBe(
      AutoFulfillStatus.PENDING
    );
  });

  it.each([
    ['no SellerHill listing behind the sale', { freshIfInserted: true, hasListing: false, quantity: 1 }],
    ['first seen long after it was placed', { freshIfInserted: false, hasListing: true, quantity: 1 }],
    ['no quantity', { freshIfInserted: true, hasListing: true, quantity: 0 }],
  ])('starts at skipped: %s', (_label, input) => {
    expect(initialAutoFulfillStatus(input)).toBe(AutoFulfillStatus.SKIPPED);
  });
});

/**
 * Source guards. Each of these reverted-looking-harmless edits would silently
 * bring back "an order is read once": the wrong filter, the old paging, a bare
 * status overwrite, or automation on any insert.
 */
describe('order change tracking — source guards', () => {
  const read = (file: string): string =>
    fs
      .readFileSync(path.join(__dirname, file), 'utf8')
      .replace(/\r\n/g, '\n')
      // strip comments so prose cannot satisfy or trip a guard
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^\s*--.*$/gm, '');

  const fulfillment = read('ebay-fulfillment.service.ts');
  const sync = read('order-sync.service.ts');

  it('getOrders filters on lastmodifieddate and pages by offset', () => {
    expect(fulfillment).toMatch(/params\.filter = `lastmodifieddate:\[/);
    expect(fulfillment).not.toMatch(/creationdate:\[/);
    expect(fulfillment).toMatch(/offset: String\(/);
    expect(fulfillment).not.toMatch(/continuation_token/);
  });

  it('order sync pages by offset against the reported total', () => {
    expect(sync).toMatch(/modifiedFrom: syncFromDate/);
    expect(sync).toMatch(/offset >= result\.total/);
    expect(sync).not.toMatch(/nextCursor/);
  });

  it('the upsert merges the status forward-only, never a bare overwrite', () => {
    expect(sync).toMatch(/status = \$\{buildSyncedStatusSql\(\)\}/);
    expect(sync).not.toMatch(/status = EXCLUDED\.status,/);
  });

  it('a captured cancellation or refund is never blanked by a later read', () => {
    for (const column of ['ebay_cancel_state', 'ebay_cancelled_at', 'ebay_refunded_amount', 'ebay_refunded_at']) {
      expect(sync).toContain(`${column} = COALESCE(EXCLUDED.${column}, orders.${column})`);
    }
  });

  it('stores the eBay order line item id at sync and never blanks it on a later read', () => {
    // The shipping fulfillment names `lineItems[].lineItemId`, not the
    // listing's legacy item id (eBay answered 400 "Invalid line item id" on
    // the first live conversion). Like ebay_legacy_item_id it never changes,
    // so it only ever fills a blank.
    expect(sync).toMatch(/lineItem\?\.lineItemId \?\? null/);
    expect(sync).toContain('ebay_line_item_id = COALESCE(orders.ebay_line_item_id, EXCLUDED.ebay_line_item_id)');
  });

  it('never restores the address of a buyer whose data was erased', () => {
    expect(sync).not.toMatch(/shipping_address = EXCLUDED\.shipping_address,/);
    expect(sync).toMatch(
      /shipping_address = CASE\s+WHEN orders\.buyer_data_erased_at IS NOT NULL THEN orders\.shipping_address\s+ELSE EXCLUDED\.shipping_address\s+END,/
    );
    // No other buyer column is written on the conflict path at all.
    const conflict = sync.slice(sync.indexOf('ON CONFLICT (ebay_order_id) DO UPDATE SET'), sync.indexOf('RETURNING id, (xmax = 0)'));
    for (const column of ['buyer_name', 'buyer_email', 'buyer_phone', 'buyer_username']) {
      expect(conflict).not.toContain(`${column} =`);
    }
  });

  it('stock, purchase and buyer message fire only for a fresh sale', () => {
    expect(sync).toMatch(/const freshSale = ingest\.isFreshSale\(inserted\);/);
    // Exactly one insert-only gate is left: the sold counter.
    expect(sync.match(/if \(inserted && listingId && entity\.quantity > 0\)/g)).toHaveLength(1);
    expect(sync.match(/if \(freshSale && listingId && entity\.quantity > 0\)/g)).toHaveLength(2);
    expect(sync).toMatch(/if \(freshSale && !isOrderAlreadyFulfilled\(entity\.status\)/);
  });

  it('a new row is inserted with its own starting automation status, never the column default', () => {
    // The INSERT names the column and binds it; the conflict path never
    // rewrites it (automation state belongs to the paths that act on it).
    expect(sync).toMatch(/ebay_line_item_count, ebay_ship_by_date,\s+auto_fulfill_status\s+\) VALUES/);
    expect(sync).toContain('$39::auto_fulfill_status');
    expect(sync).toMatch(
      /initialAutoFulfillStatus\(\{\s+freshIfInserted: ingest\.isFreshSale\(true\),\s+hasListing: !!listingId,\s+quantity: entity\.quantity,\s+\}\)/
    );
    const conflict = sync.slice(
      sync.indexOf('ON CONFLICT (ebay_order_id) DO UPDATE SET'),
      sync.indexOf('RETURNING id, (xmax = 0)')
    );
    expect(conflict).not.toContain('auto_fulfill_status');
  });

  it('a failed enqueue never leaves the order reading "buying"', () => {
    const caught = sync.slice(
      sync.indexOf('await this.maybeEnqueueAutoFulfill(entity, listingOverPlanLimit);'),
      sync.indexOf('// Buyer auto-messaging (best-effort; never fails order sync).')
    );
    expect(caught).toContain('await this.failStrandedAutoFulfill(entity.userId, entity.ebayOrderId);');
    const settle = sync.slice(sync.indexOf('private async failStrandedAutoFulfill('));
    expect(settle.slice(0, settle.indexOf('  /**'))).toMatch(
      /AND auto_fulfill_status = \$3\s+AND auto_fulfill_submitted_at IS NULL/
    );
  });

  it('the watermark is the run start minus the overlap, not "now"', () => {
    expect(sync).toMatch(/SET last_ebay_sync_at = \$2/);
    expect(sync).not.toMatch(/last_ebay_sync_at = CURRENT_TIMESTAMP/);
  });
});
