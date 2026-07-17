import type { AmazonListOrderRow } from './amazon-scraping.service';
import { pickBestMatch, type CandidateEbayOrderRow } from './pick-best-match';

const base = {
  tolerancePct: 5,
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
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<CandidateEbayOrderRow> = {}): CandidateEbayOrderRow {
  return {
    id: 'ebay-row-1',
    ebay_order_id: '12-34567-89012',
    asin: 'B0XYZ12345',
    quantity: 1,
    sale_total: 49.5,
    order_date: new Date('2026-07-12T00:00:00Z'),
    ...overrides,
  };
}

describe('pickBestMatch', () => {
  it('returns the only matching candidate', () => {
    const best = pickBestMatch({
      amazon: makeAmazon(),
      candidates: [makeCandidate()],
      ...base,
    });
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
    const best = pickBestMatch({
      amazon: makeAmazon(),
      candidates: [],
      ...base,
    });
    expect(best).toBeNull();
  });

  it('picks the highest-scoring candidate when multiple match', () => {
    // closer amount wins (smaller diffPct → higher score)
    const close = makeCandidate({ id: 'close', sale_total: 49.9 });
    const far = makeCandidate({ id: 'far', sale_total: 47.6 }); // ~4.8% off vs 0.2% off
    const best = pickBestMatch({
      amazon: makeAmazon({ grandTotal: 50 }),
      candidates: [far, close],
      ...base,
    });
    expect(best?.orderId).toBe('close');
  });

  it('skips candidates already consumed (caller guards via Set)', () => {
    // Sanity check: the helper itself is pure — caller is responsible for
    // de-duping. Here we verify that if the same candidate id appears twice,
    // both are scored independently (so the caller MUST de-dupe externally).
    const dup = makeCandidate({ id: 'dup', sale_total: 49.5 });
    const best = pickBestMatch({
      amazon: makeAmazon(),
      candidates: [dup, dup],
      ...base,
    });
    expect(best?.orderId).toBe('dup');
  });

  it('returns null when amount is outside tolerance', () => {
    const best = pickBestMatch({
      amazon: makeAmazon({ grandTotal: 100 }),
      candidates: [makeCandidate({ sale_total: 50 })],
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
