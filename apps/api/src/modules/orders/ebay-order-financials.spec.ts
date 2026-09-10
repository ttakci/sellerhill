import { parseEbayAmount, sumCollectAndRemitTax } from './ebay-order-financials';

describe('parseEbayAmount', () => {
  it('parses a real eBay money object', () => {
    expect(parseEbayAmount({ value: '7.81', currency: 'AUD' })).toBe(7.81);
  });

  it('keeps a genuine zero as 0, never null', () => {
    // 0 means "eBay told us the amount is zero"; null means "eBay said nothing".
    // Collapsing the two is how a real $0 fee becomes indistinguishable from an
    // unreported one — the same distinction `orders.net_profit` already keeps.
    expect(parseEbayAmount({ value: '0.00' })).toBe(0);
    expect(parseEbayAmount({ value: '0' })).toBe(0);
  });

  it('returns null when eBay did not supply the field', () => {
    expect(parseEbayAmount(undefined)).toBeNull();
    expect(parseEbayAmount(null)).toBeNull();
    expect(parseEbayAmount({})).toBeNull();
    expect(parseEbayAmount({ value: '' })).toBeNull();
  });

  it('returns null rather than NaN on unparseable text', () => {
    expect(parseEbayAmount({ value: 'abc' })).toBeNull();
  });
});

describe('sumCollectAndRemitTax', () => {
  it('returns null when eBay reported no Collect & Remit container at all', () => {
    expect(sumCollectAndRemitTax(undefined)).toBeNull();
    expect(sumCollectAndRemitTax([])).toBeNull();
    expect(sumCollectAndRemitTax([{}])).toBeNull();
    expect(sumCollectAndRemitTax([{ ebayCollectAndRemitTaxes: [] }])).toBeNull();
  });

  it('reads the tax off a single line item', () => {
    expect(
      sumCollectAndRemitTax([{ ebayCollectAndRemitTaxes: [{ amount: { value: '4.13' } }] }]),
    ).toBe(4.13);
  });

  it('sums across every line item, not just the first', () => {
    // `mapEbayOrderToEntity` reads lineItems[0] for product data, but the tax is
    // charged per line item — taking only the first would understate a
    // multi-item order.
    expect(
      sumCollectAndRemitTax([
        { ebayCollectAndRemitTaxes: [{ amount: { value: '4.13' } }] },
        { ebayCollectAndRemitTaxes: [{ amount: { value: '2.50' } }] },
      ]),
    ).toBe(6.63);
  });

  it('sums several tax entries on one line item', () => {
    expect(
      sumCollectAndRemitTax([
        {
          ebayCollectAndRemitTaxes: [
            { amount: { value: '1.10' } },
            { amount: { value: '0.90' } },
          ],
        },
      ]),
    ).toBe(2);
  });

  it('ignores line items that carry no tax', () => {
    expect(
      sumCollectAndRemitTax([
        { ebayCollectAndRemitTaxes: [{ amount: { value: '4.13' } }] },
        {},
      ]),
    ).toBe(4.13);
  });

  it('rounds away float drift from summing', () => {
    expect(
      sumCollectAndRemitTax([
        { ebayCollectAndRemitTaxes: [{ amount: { value: '0.10' } }] },
        { ebayCollectAndRemitTaxes: [{ amount: { value: '0.20' } }] },
      ]),
    ).toBe(0.3);
  });

  it('reports a real zero as 0 when eBay sent an entry saying zero', () => {
    expect(
      sumCollectAndRemitTax([{ ebayCollectAndRemitTaxes: [{ amount: { value: '0.00' } }] }]),
    ).toBe(0);
  });

  it('returns null when every entry is unusable', () => {
    expect(
      sumCollectAndRemitTax([{ ebayCollectAndRemitTaxes: [{ amount: { value: 'abc' } }, {}] }]),
    ).toBeNull();
  });
});
