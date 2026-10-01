import type { AmazonScrapedOrderData } from '@repo/shared';

import { isOrderIdOnPage } from './amazon-order-parser.service';
import { AmazonController } from './amazon.controller';

/**
 * The manual link is the seller's recovery after a failed automatic purchase:
 * they name the Amazon order, so the order must be attached even when its cost
 * summary cannot be read. Driven against fakes — no browser, no database.
 */

const ORDER = { id: 'order-uuid', ebay_order_id: '17-00000-00000' };
const AMAZON_ORDER_ID = '113-1234567-1234567';

function scraped(overrides: Partial<AmazonScrapedOrderData>): AmazonScrapedOrderData {
  return {
    amazonOrderId: AMAZON_ORDER_ID,
    status: 'pending',
    items: [{ title: 'Item', price: 8.79, quantity: 1 }],
    subtotal: 8.79,
    shipping: 0,
    tax: 0.68,
    grandTotal: 9.47,
    costCaptureFailed: false,
    orderIdOnPage: true,
    ...overrides,
  };
}

function build(data: AmazonScrapedOrderData) {
  const updates: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: jest.fn((sql: string, params: unknown[]) => {
      if (sql.includes('SELECT')) {
        return Promise.resolve([ORDER]);
      }
      updates.push({ sql, params });
      return Promise.resolve([]);
    }),
  };
  const scraping = { scrapeOrder: jest.fn().mockResolvedValue(data) };
  const tracking = {
    scheduleOrderTracking: jest.fn().mockResolvedValue(undefined),
    triggerImmediateTracking: jest.fn().mockResolvedValue(undefined),
  };
  const orderSync = { recomputeProfit: jest.fn().mockResolvedValue(undefined) };
  const quota = { isSuspended: jest.fn().mockResolvedValue(false) };
  const controller = new AmazonController(
    {} as never,
    scraping as never,
    tracking as never,
    {} as never,
    db as never,
    orderSync as never,
    quota as never,
    {} as never,
    {} as never
  );
  const link = () =>
    controller.linkAmazonOrder({ user: { sub: 'user-1' } } as never, ORDER.id, {
      amazonAccountId: 'acct-1',
      amazonOrderId: ` ${AMAZON_ORDER_ID} `,
    } as never);
  return { link, updates, scraping, tracking, orderSync };
}

describe('manual Amazon link', () => {
  it('links with real costs when the summary reads', async () => {
    const { link, updates, tracking, orderSync, scraping } = build(scraped({}));

    await expect(link()).resolves.toMatchObject({ success: true, linked: true });
    expect(scraping.scrapeOrder).toHaveBeenCalledWith('user-1', 'acct-1', AMAZON_ORDER_ID);
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toContain('amazon_linked_at = CURRENT_TIMESTAMP');
    expect(orderSync.recomputeProfit).toHaveBeenCalledWith(ORDER.ebay_order_id);
    expect(tracking.scheduleOrderTracking).toHaveBeenCalledWith(ORDER.id, 'acct-1');
  });

  it('still attaches the order and starts tracking when costs are unreadable', async () => {
    const { link, updates, tracking, orderSync } = build(
      scraped({ costCaptureFailed: true, subtotal: 0, tax: 0, grandTotal: 0, status: 'shipped' })
    );

    await expect(link()).resolves.toMatchObject({ success: true, linked: true, reason: 'cost_capture_failed' });
    expect(updates).toHaveLength(1);
    const { sql, params } = updates[0];
    expect(sql).toContain('amazon_order_id = $2');
    expect(params).toContain(AMAZON_ORDER_ID);
    // No cost is written and the link is not marked cost-trusted.
    expect(sql).not.toMatch(/purchase_price|amazon_tax|amazon_shipping/);
    expect(sql).not.toContain('amazon_linked_at = CURRENT_TIMESTAMP');
    // Never forced to FAILED — that status drops the order out of cost capture.
    expect(orderSync.recomputeProfit).toHaveBeenCalledWith(ORDER.ebay_order_id);
    expect(tracking.scheduleOrderTracking).toHaveBeenCalledWith(ORDER.id, 'acct-1');
    expect(tracking.triggerImmediateTracking).toHaveBeenCalledWith(ORDER.id, 'acct-1');
  });

  it('writes nothing when the page does not show the order id', async () => {
    const { link, updates, tracking, orderSync } = build(
      scraped({ costCaptureFailed: true, orderIdOnPage: false })
    );

    await expect(link()).resolves.toMatchObject({ success: false, linked: false, reason: 'order_not_found' });
    expect(updates).toHaveLength(0);
    expect(orderSync.recomputeProfit).not.toHaveBeenCalled();
    expect(tracking.scheduleOrderTracking).not.toHaveBeenCalled();
  });
});

describe('isOrderIdOnPage', () => {
  it('needs the exact id in the visible text', () => {
    expect(isOrderIdOnPage(`Order # ${AMAZON_ORDER_ID}\nOrder Summary`, AMAZON_ORDER_ID)).toBe(true);
    expect(isOrderIdOnPage('Sorry, we could not find that order', AMAZON_ORDER_ID)).toBe(false);
    expect(isOrderIdOnPage('anything', '  ')).toBe(false);
  });
});
