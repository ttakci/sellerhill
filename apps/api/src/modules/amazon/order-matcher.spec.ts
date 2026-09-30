import { scoreAmazonOrderMatch, type AmazonMatchCandidate, type EbayMatchCandidate } from './order-matcher';

const base = {
  tolerancePct: 15,
  windowDays: 7,
};

const amazon = (o: Partial<AmazonMatchCandidate> = {}): AmazonMatchCandidate => ({
  asin: 'B0XYZ',
  quantity: 1,
  grandTotal: 9.47,
  orderDate: '2026-09-30',
  recipientName: 'SAM BUYER',
  recipientZip: '97024',
  ...o,
});

const ebay = (o: Partial<EbayMatchCandidate> = {}): EbayMatchCandidate => ({
  asin: 'B0XYZ',
  quantity: 1,
  expectedCost: 8.79,
  orderDate: '2026-09-30',
  buyerName: 'Sam A. Buyer',
  buyerZip: '97024-1111',
  ...o,
});

describe('scoreAmazonOrderMatch', () => {
  it('matches when asin + qty + recipient + date align', () => {
    const r = scoreAmazonOrderMatch({ amazon: amazon(), ebay: ebay(), ...base });
    expect(r.match).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('matches the live 17-15222-04697 shape: Amazon cost 27 % under the eBay sale is no longer a refusal', () => {
    // eBay sale $12.98, Amazon charged $9.47, provisional product cost $8.79.
    const r = scoreAmazonOrderMatch({
      amazon: amazon({ grandTotal: 9.47 }),
      ebay: ebay({ expectedCost: 8.79 }),
      ...base,
    });
    expect(r.match).toBe(true);
  });

  it('rejects when asin differs', () => {
    expect(scoreAmazonOrderMatch({ amazon: amazon({ asin: 'B0AAA' }), ebay: ebay(), ...base }).match).toBe(false);
  });

  it('rejects when quantity differs', () => {
    expect(scoreAmazonOrderMatch({ amazon: amazon({ quantity: 2 }), ebay: ebay(), ...base }).match).toBe(false);
  });

  it('rejects when the recipient is another person at the same postcode', () => {
    const r = scoreAmazonOrderMatch({ amazon: amazon({ recipientName: 'LEE OTHER' }), ebay: ebay(), ...base });
    expect(r.match).toBe(false);
  });

  it('rejects when the postcode differs', () => {
    expect(scoreAmazonOrderMatch({ amazon: amazon({ recipientZip: '97025' }), ebay: ebay(), ...base }).match).toBe(false);
  });

  it('rejects when the recipient could not be read (never guesses)', () => {
    expect(scoreAmazonOrderMatch({ amazon: amazon({ recipientName: null }), ebay: ebay(), ...base }).match).toBe(false);
    expect(scoreAmazonOrderMatch({ amazon: amazon({ recipientZip: null }), ebay: ebay(), ...base }).match).toBe(false);
    expect(scoreAmazonOrderMatch({ amazon: amazon(), ebay: ebay({ buyerZip: null }), ...base }).match).toBe(false);
  });

  it('rejects when date outside window', () => {
    const r = scoreAmazonOrderMatch({
      amazon: amazon({ orderDate: '2026-07-01' }),
      ebay: ebay({ orderDate: '2026-07-20' }),
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when asin missing on either side', () => {
    expect(scoreAmazonOrderMatch({ amazon: amazon({ asin: undefined }), ebay: ebay(), ...base }).match).toBe(false);
  });

  it('the amount never blocks — it only adds a bonus when close to the expected cost', () => {
    const close = scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 9.47 }), ebay: ebay({ expectedCost: 8.79 }), ...base });
    const far = scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 40 }), ebay: ebay({ expectedCost: 8.79 }), ...base });
    const unknown = scoreAmazonOrderMatch({ amazon: amazon(), ebay: ebay({ expectedCost: null }), ...base });
    expect(far.match).toBe(true);
    expect(unknown.match).toBe(true);
    expect(close.score).toBeGreaterThan(far.score);
    expect(far.score).toBe(unknown.score);
  });
});
