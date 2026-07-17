import { scoreAmazonOrderMatch } from './order-matcher';

const base = {
  tolerancePct: 5,
  windowDays: 7,
};

describe('scoreAmazonOrderMatch', () => {
  it('matches when asin+qty+amount+date all align', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 1, grandTotal: 50, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 49.5, orderDate: '2026-07-12' },
      ...base,
    });
    expect(r.match).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('rejects when asin differs', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0AAA', quantity: 1, grandTotal: 50, orderDate: '2026-07-10' },
      ebay: { asin: 'B0BBB', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when quantity differs', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 2, grandTotal: 100, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when amount outside tolerance', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 1, grandTotal: 100, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when date outside window', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 1, grandTotal: 50, orderDate: '2026-07-01' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-20' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when asin missing on either side', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { quantity: 1, grandTotal: 50, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });
});
