import type { AmazonListOrderRow } from './amazon-scraping.service';
import { planCostCaptureLinks, resolveScanSince } from './cost-capture-plan';
import type { CandidateEbayOrderRow } from './pick-best-match';

const base = { tolerancePct: 15, windowDays: 7, accountId: 'acc-1' };

function amazonOrder(overrides: Partial<AmazonListOrderRow> = {}): AmazonListOrderRow {
  return {
    amazonOrderId: '111-2222222-3333333',
    asin: 'B0XYZ12345',
    quantity: 1,
    grandTotal: 50,
    tax: 3,
    shipping: 0,
    purchasePrice: 47,
    orderDate: new Date('2026-09-30T00:00:00Z'),
    recipientName: 'SAM BUYER',
    recipientZip: '97024',
    ...overrides,
  };
}

function candidate(overrides: Partial<CandidateEbayOrderRow> = {}): CandidateEbayOrderRow {
  return {
    id: 'order-1',
    ebay_order_id: '12-34567-89012',
    asin: 'B0XYZ12345',
    quantity: 1,
    purchase_price: 46,
    order_date: new Date('2026-09-30T10:00:00Z'),
    buyer_name: 'Sam Buyer',
    shipping_address: { fullName: 'Sam Buyer', zipCode: '97024-1111' },
    auto_fulfill_submitted_at: null,
    amazon_account_id: null,
    amazon_order_id: null,
    ...overrides,
  };
}

/** The links alone — most cases below are about what gets linked. */
function linksOf(input: Parameters<typeof planCostCaptureLinks>[0]) {
  return planCostCaptureLinks(input).links;
}

describe('planCostCaptureLinks', () => {
  it('links a matching Amazon order to the waiting eBay order', () => {
    const { links, suspects } = planCostCaptureLinks({
      amazonOrders: [amazonOrder()],
      candidates: [candidate()],
      holders: [],
      ...base,
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ orderId: 'order-1', via: 'matched', clicked: false });
    expect(suspects).toEqual([]);
  });

  // The repeat-buyer defect: the same buyer buys the same product twice in a
  // week. The first sale was bought and linked; the Amazon order that paid for
  // it must NOT also be attributed to the second sale.
  it('never links an Amazon order that another order already holds', () => {
    const links = linksOf({
      amazonOrders: [amazonOrder()],
      candidates: [candidate({ id: 'second-sale', ebay_order_id: 'B' })],
      holders: [{ id: 'first-sale', amazon_order_id: '111-2222222-3333333' }],
      ...base,
    });
    expect(links).toEqual([]);
  });

  it('fills the costs of a candidate that already names this Amazon order — without the matcher', () => {
    // Hand-linked with an unreadable cost summary: the order holds the id and
    // is still a candidate. Recipient/date need not match; the seller named it.
    const held = candidate({
      id: 'hand-linked',
      amazon_order_id: '111-2222222-3333333',
      buyer_name: 'Someone Else',
      shipping_address: { fullName: 'Someone Else', zipCode: '10001' },
    });
    const links = linksOf({
      amazonOrders: [amazonOrder()],
      candidates: [held],
      holders: [{ id: 'hand-linked', amazon_order_id: '111-2222222-3333333' }],
      ...base,
    });
    expect(links).toEqual([expect.objectContaining({ orderId: 'hand-linked', via: 'held' })]);
  });

  it('never offers a candidate that already names an Amazon order to the matcher', () => {
    const named = candidate({ id: 'named', amazon_order_id: '999-0000000-0000000' });
    const links = linksOf({
      amazonOrders: [amazonOrder()],
      candidates: [named],
      holders: [{ id: 'named', amazon_order_id: '999-0000000-0000000' }],
      ...base,
    });
    expect(links).toEqual([]);
  });

  it('gives an eBay order at most one Amazon order per run', () => {
    const links = linksOf({
      amazonOrders: [
        amazonOrder({ amazonOrderId: '111-1111111-1111111' }),
        amazonOrder({ amazonOrderId: '222-2222222-2222222' }),
      ],
      candidates: [candidate()],
      holders: [],
      ...base,
    });
    expect(links.map((l) => l.amazon.amazonOrderId)).toEqual(['111-1111111-1111111']);
  });

  it('marks a link to a clicked order, and refuses one from a different account than the click', () => {
    const clicked = candidate({
      auto_fulfill_submitted_at: new Date('2026-09-30T11:00:00Z'),
      amazon_account_id: 'acc-1',
    });
    expect(linksOf({ amazonOrders: [amazonOrder()], candidates: [clicked], holders: [], ...base })).toEqual([
      expect.objectContaining({ orderId: 'order-1', clicked: true }),
    ]);
    expect(
      linksOf({ amazonOrders: [amazonOrder()], candidates: [clicked], holders: [], ...base, accountId: 'acc-2' })
    ).toEqual([]);
  });

  it('skips an Amazon order with no id', () => {
    expect(
      linksOf({
        amazonOrders: [amazonOrder({ amazonOrderId: '' })],
        candidates: [candidate()],
        holders: [],
        ...base,
      })
    ).toEqual([]);
  });

  // Two Amazon orders, two waiting sales of the same buyer and product. Once the
  // first Amazon order took the better-scoring sale, the second must go to the
  // OTHER sale — not be dropped because its best candidate was already taken.
  it('offers the next candidate when the best one was linked earlier in the run', () => {
    const early = candidate({ id: 'early', ebay_order_id: 'A', order_date: new Date('2026-09-30T10:00:00Z') });
    const late = candidate({ id: 'late', ebay_order_id: 'B', order_date: new Date('2026-09-29T10:00:00Z') });
    const links = linksOf({
      amazonOrders: [
        amazonOrder({ amazonOrderId: '111-1111111-1111111' }),
        amazonOrder({ amazonOrderId: '222-2222222-2222222' }),
      ],
      candidates: [early, late],
      holders: [],
      ...base,
    });
    expect(links.map((l) => [l.amazon.amazonOrderId, l.orderId])).toEqual([
      ['111-1111111-1111111', 'early'],
      ['222-2222222-2222222', 'late'],
    ]);
  });

  describe('suspects — an order the checkout clicked for, and an Amazon order it could not link', () => {
    const clicked = candidate({
      auto_fulfill_submitted_at: new Date('2026-09-30T11:00:00Z'),
      amazon_account_id: 'acc-1',
    });

    it('reports an unlinked Amazon order with the same product, dated around the click', () => {
      // The ship-to could not be read, so the strict matcher refuses the link.
      const plan = planCostCaptureLinks({
        amazonOrders: [amazonOrder({ recipientName: null, recipientZip: null })],
        candidates: [clicked],
        holders: [],
        ...base,
      });
      expect(plan.links).toEqual([]);
      expect(plan.suspects).toEqual([
        { orderId: 'order-1', ebayOrderId: '12-34567-89012', amazonOrderId: '111-2222222-3333333' },
      ]);
    });

    it('does not report an order that was linked, belongs to another product, or is held elsewhere', () => {
      expect(
        planCostCaptureLinks({ amazonOrders: [amazonOrder()], candidates: [clicked], holders: [], ...base }).suspects
      ).toEqual([]);
      expect(
        planCostCaptureLinks({
          amazonOrders: [amazonOrder({ asin: 'B0OTHER000', recipientName: null })],
          candidates: [clicked],
          holders: [],
          ...base,
        }).suspects
      ).toEqual([]);
      expect(
        planCostCaptureLinks({
          amazonOrders: [amazonOrder({ recipientName: null })],
          candidates: [clicked],
          holders: [{ id: 'another-order', amazon_order_id: '111-2222222-3333333' }],
          ...base,
        }).suspects
      ).toEqual([]);
    });

    it('does not report an order dated days away from the click, or read from another account', () => {
      expect(
        planCostCaptureLinks({
          amazonOrders: [amazonOrder({ recipientName: null, orderDate: new Date('2026-10-05T00:00:00Z') })],
          candidates: [clicked],
          holders: [],
          ...base,
        }).suspects
      ).toEqual([]);
      expect(
        planCostCaptureLinks({
          amazonOrders: [amazonOrder({ recipientName: null })],
          candidates: [clicked],
          holders: [],
          ...base,
          accountId: 'acc-2',
        }).suspects
      ).toEqual([]);
    });

    it('never makes a suspect of an order nobody clicked for', () => {
      expect(
        planCostCaptureLinks({
          amazonOrders: [amazonOrder({ recipientName: null })],
          candidates: [candidate()],
          holders: [],
          ...base,
        }).suspects
      ).toEqual([]);
    });
  });
});

describe('resolveScanSince', () => {
  const now = new Date('2026-10-01T12:00:00Z');

  it('falls back to 30 days on a first scan with no candidates', () => {
    expect(resolveScanSince({ watermark: null, candidates: [], now }).toISOString()).toBe('2026-09-01T12:00:00.000Z');
  });

  it('starts at the watermark when the oldest waiting sale is older than it', () => {
    const since = resolveScanSince({
      watermark: new Date('2026-09-29T00:00:00Z'),
      candidates: [{ order_date: new Date('2026-09-20T00:00:00Z'), amazon_order_id: null }],
      now,
    });
    expect(since.toISOString()).toBe('2026-09-29T00:00:00.000Z');
  });

  it('skips ahead to the oldest waiting sale (less the slack) when the watermark is stale', () => {
    // The account was not scanned for weeks because nothing was waiting.
    const since = resolveScanSince({
      watermark: new Date('2026-08-01T00:00:00Z'),
      candidates: [
        { order_date: new Date('2026-09-30T00:00:00Z'), amazon_order_id: null },
        { order_date: new Date('2026-09-28T00:00:00Z'), amazon_order_id: null },
      ],
      now,
    });
    expect(since.toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });

  it('reaches back before the watermark for a candidate that already names its Amazon order', () => {
    const since = resolveScanSince({
      watermark: new Date('2026-09-29T00:00:00Z'),
      candidates: [{ order_date: new Date('2026-09-20T00:00:00Z'), amazon_order_id: '113-1' }],
      now,
    });
    expect(since.toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  // While a purchase is unconfirmed, every scan re-reads the days around it —
  // "the scan found nothing" must keep meaning "it is not there".
  it('reaches back before the watermark for an order the automatic checkout clicked for', () => {
    const since = resolveScanSince({
      watermark: new Date('2026-09-30T12:00:00Z'),
      candidates: [
        {
          order_date: new Date('2026-09-30T09:00:00Z'),
          amazon_order_id: null,
          auto_fulfill_submitted_at: new Date('2026-09-30T10:00:00Z'),
        },
      ],
      now,
    });
    expect(since.toISOString()).toBe('2026-09-28T09:00:00.000Z');
  });
});
