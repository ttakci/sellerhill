import type { AmazonListOrderRow } from './amazon-scraping.service';
import { pickBestMatch, type CandidateEbayOrderRow } from './pick-best-match';

const base = {
  tolerancePct: 15,
  windowDays: 7,
};

function makeAmazon(overrides: Partial<AmazonListOrderRow> = {}): AmazonListOrderRow {
  return {
    amazonOrderId: '111-2222222-3333333',
    asin: 'B0XYZ12345',
    quantity: 1,
    grandTotal: 50,
    tax: 3,
    shipping: 0,
    purchasePrice: 47,
    orderDate: new Date('2026-07-10T00:00:00Z'),
    recipientName: 'SAM BUYER',
    recipientZip: '97024',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<CandidateEbayOrderRow> = {}): CandidateEbayOrderRow {
  return {
    id: 'ebay-row-1',
    ebay_order_id: '12-34567-89012',
    asin: 'B0XYZ12345',
    quantity: 1,
    purchase_price: 46,
    order_date: new Date('2026-07-12T00:00:00Z'),
    buyer_name: 'Sam Buyer',
    shipping_address: { fullName: 'Sam Buyer', zipCode: '97024-1111' },
    ...overrides,
  };
}

describe('pickBestMatch', () => {
  it('returns the only matching candidate', () => {
    const best = pickBestMatch({ amazon: makeAmazon(), candidates: [makeCandidate()], ...base });
    expect(best).not.toBeNull();
    expect(best?.orderId).toBe('ebay-row-1');
    expect(best?.ebayOrderId).toBe('12-34567-89012');
    expect(best?.score).toBeGreaterThan(0);
  });

  it('returns null when no candidate matches (asin mismatch)', () => {
    const best = pickBestMatch({
      amazon: makeAmazon({ asin: 'B0AAA00000' }),
      candidates: [makeCandidate({ asin: 'B0BBB00000' })],
      ...base,
    });
    expect(best).toBeNull();
  });

  it('returns null when candidates list is empty', () => {
    expect(pickBestMatch({ amazon: makeAmazon(), candidates: [], ...base })).toBeNull();
  });

  it('same product, same week, two buyers: the recipient picks the right eBay order', () => {
    const sam = makeCandidate({ id: 'sam', ebay_order_id: 'A' });
    const lee = makeCandidate({
      id: 'lee',
      ebay_order_id: 'B',
      buyer_name: 'Lee Other',
      shipping_address: { fullName: 'Lee Other', zipCode: '72764' },
    });
    const best = pickBestMatch({ amazon: makeAmazon(), candidates: [lee, sam], ...base });
    expect(best?.orderId).toBe('sam');
  });

  it('falls back to buyer_name when the ship-to carries no name', () => {
    const best = pickBestMatch({
      amazon: makeAmazon(),
      candidates: [makeCandidate({ shipping_address: { zipCode: '97024' } })],
      ...base,
    });
    expect(best?.orderId).toBe('ebay-row-1');
  });

  it('prefers the candidate whose date is closer', () => {
    const near = makeCandidate({ id: 'near', ebay_order_id: 'A', order_date: new Date('2026-07-10T00:00:00Z') });
    const far = makeCandidate({ id: 'far', ebay_order_id: 'B', order_date: new Date('2026-07-15T00:00:00Z') });
    expect(pickBestMatch({ amazon: makeAmazon(), candidates: [far, near], ...base })?.orderId).toBe('near');
  });

  it('refuses a tie between two different eBay orders (the seller links it by hand)', () => {
    const one = makeCandidate({ id: 'one', ebay_order_id: 'A' });
    const two = makeCandidate({ id: 'two', ebay_order_id: 'B' });
    expect(pickBestMatch({ amazon: makeAmazon(), candidates: [one, two], ...base })).toBeNull();
  });

  it('the same eBay order listed twice is not a tie (caller de-dupes across Amazon rows)', () => {
    const dup = makeCandidate({ id: 'dup' });
    expect(pickBestMatch({ amazon: makeAmazon(), candidates: [dup, dup], ...base })?.orderId).toBe('dup');
  });

  it('an Amazon total far from the expected cost still links — the amount is a tie-break only', () => {
    const best = pickBestMatch({
      amazon: makeAmazon({ grandTotal: 100 }),
      candidates: [makeCandidate({ purchase_price: 50 })],
      ...base,
    });
    expect(best?.orderId).toBe('ebay-row-1');
  });

  it('returns null when the recipient is not the eBay buyer', () => {
    const best = pickBestMatch({
      amazon: makeAmazon({ recipientName: 'SOMEONE ELSE' }),
      candidates: [makeCandidate()],
      ...base,
    });
    expect(best).toBeNull();
  });

  it('returns null when date is outside window', () => {
    const best = pickBestMatch({
      amazon: makeAmazon({ orderDate: new Date('2026-06-01T00:00:00Z') }),
      candidates: [makeCandidate({ order_date: new Date('2026-07-20T00:00:00Z') })],
      ...base,
    });
    expect(best).toBeNull();
  });

  it('returns null when quantity differs', () => {
    const best = pickBestMatch({
      amazon: makeAmazon({ quantity: 2 }),
      candidates: [makeCandidate({ quantity: 1 })],
      ...base,
    });
    expect(best).toBeNull();
  });
});
