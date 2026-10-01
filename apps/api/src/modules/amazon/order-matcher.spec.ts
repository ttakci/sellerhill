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

  it('the amount is not an equality gate — it adds a bonus when close to the expected cost', () => {
    const close = scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 9.47 }), ebay: ebay({ expectedCost: 8.79 }), ...base });
    const far = scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 20 }), ebay: ebay({ expectedCost: 8.79 }), ...base });
    const unknown = scoreAmazonOrderMatch({ amazon: amazon(), ebay: ebay({ expectedCost: null }), ...base });
    expect(far.match).toBe(true);
    expect(unknown.match).toBe(true);
    expect(close.score).toBeGreaterThan(far.score);
    expect(far.score).toBe(unknown.score);
  });

  it('refuses an Amazon total that cannot be the same purchase (more than 3x off either way)', () => {
    const tooHigh = scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 40 }), ebay: ebay({ expectedCost: 8.79 }), ...base });
    const tooLow = scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 2 }), ebay: ebay({ expectedCost: 8.79 }), ...base });
    expect(tooHigh.match).toBe(false);
    expect(tooLow.match).toBe(false);
    // An unknown side never refuses: there is nothing to compare.
    expect(scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 0 }), ebay: ebay(), ...base }).match).toBe(true);
    expect(scoreAmazonOrderMatch({ amazon: amazon({ grandTotal: 40 }), ebay: ebay({ expectedCost: 0 }), ...base }).match).toBe(true);
  });

  // A purchase cannot precede the sale it fulfils. The symmetric window let
  // last week's Amazon order for the same buyer and product match this week's
  // eBay sale, which then read as purchased without ever being bought.
  it('refuses an Amazon order placed before the eBay sale', () => {
    const r = scoreAmazonOrderMatch({
      amazon: amazon({ orderDate: '2026-09-24' }),
      ebay: ebay({ orderDate: '2026-09-30T15:00:00Z' }),
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('tolerates the date-only / timezone gap of a purchase made minutes after the sale', () => {
    // eBay sale 01:00 UTC on 1 Oct = 30 Sep in the US; Amazon prints "September 30".
    const r = scoreAmazonOrderMatch({
      amazon: amazon({ orderDate: '2026-09-30' }),
      ebay: ebay({ orderDate: '2026-10-01T01:00:00Z' }),
      ...base,
    });
    expect(r.match).toBe(true);
  });

  it('still matches a purchase made days after the sale, inside the window', () => {
    const r = scoreAmazonOrderMatch({
      amazon: amazon({ orderDate: '2026-10-05' }),
      ebay: ebay({ orderDate: '2026-09-30T15:00:00Z' }),
      ...base,
    });
    expect(r.match).toBe(true);
  });

  describe('an order the automatic checkout clicked for', () => {
    const clicked = { submittedAt: '2026-09-30T16:00:00Z' };

    it('matches an Amazon order dated around the click, on the account the click was made on', () => {
      const r = scoreAmazonOrderMatch({
        amazon: amazon({ orderDate: '2026-09-30' }),
        ebay: ebay({ ...clicked, clickedOnThisAccount: true }),
        ...base,
      });
      expect(r.match).toBe(true);
    });

    it('refuses an order from a DIFFERENT Amazon account than the click', () => {
      const r = scoreAmazonOrderMatch({
        amazon: amazon({ orderDate: '2026-09-30' }),
        ebay: ebay({ ...clicked, clickedOnThisAccount: false }),
        ...base,
      });
      expect(r.match).toBe(false);
    });

    it('is not refused on the amount: a price move must not make the real order look "not found"', () => {
      const r = scoreAmazonOrderMatch({
        amazon: amazon({ orderDate: '2026-09-30', grandTotal: 40 }),
        ebay: ebay({ ...clicked, clickedOnThisAccount: true, expectedCost: 8.79 }),
        ...base,
      });
      expect(r.match).toBe(true);
    });

    it('refuses an order dated days away from the click, even inside the sale window', () => {
      const r = scoreAmazonOrderMatch({
        amazon: amazon({ orderDate: '2026-10-04' }),
        ebay: ebay({ ...clicked, clickedOnThisAccount: true }),
        ...base,
      });
      expect(r.match).toBe(false);
    });
  });
});
