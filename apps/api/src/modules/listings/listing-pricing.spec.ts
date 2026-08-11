import { type FeeConfig, type PriceRange, applyEbayFees, calculateListingPrice } from '@repo/shared';

/**
 * The shared formula behind `ListingStrategyService.calculatePrice` (API) and
 * the Listing Settings Group drawer's client-side price calculator (web) —
 * tested once here so both callers are covered.
 */
describe('calculateListingPrice', () => {
  const fees: FeeConfig = { ebayFeePercent: 13, fixedFeeAmount: 0.3 };
  const ranges: PriceRange[] = [
    { id: 'r1', minPrice: 0, maxPrice: 50, profitMarginPercent: 20 },
    { id: 'r2', minPrice: 50.01, maxPrice: 9999, fixedProfitAmount: 10 },
  ];

  it('applies margin, then reverse-calculates the eBay fee with no tax', () => {
    const result = calculateListingPrice(20, ranges, fees, 0);
    // netTarget = 20 * 1.2 = 24; finalPrice = (24 + 0.3) / (1 - 0.13) = 27.93
    expect(result.finalPrice).toBeCloseTo(27.93, 2);
    expect(result.purchasePrice).toBe(20);
    expect(result.estimatedProfit).toBeCloseTo(4, 2); // 24 - 20
  });

  it('raises the cost basis (and price) when a purchase tax rate is set', () => {
    const withoutTax = calculateListingPrice(20, ranges, fees, 0);
    const withTax = calculateListingPrice(20, ranges, fees, 8);
    // trueCost = 20 * 1.08 = 21.6; netTarget = 21.6 * 1.2 = 25.92
    expect(withTax.finalPrice).toBeGreaterThan(withoutTax.finalPrice);
    expect(withTax.estimatedProfit).toBeCloseTo(25.92 - 21.6, 2);
  });

  it('never counts the tax markup itself as profit', () => {
    // A pass-through group (no margin, no fixed profit) — the seller should
    // net exactly $0 profit, not the tax amount, once tax is priced in.
    const passthrough: PriceRange[] = [{ id: 'r1', minPrice: 0, maxPrice: 9999 }];
    const result = calculateListingPrice(20, passthrough, fees, 8);
    expect(result.estimatedProfit).toBeCloseTo(0, 2);
  });

  it('falls back to a 20% margin when no range covers the price', () => {
    const result = calculateListingPrice(20000, ranges, fees, 0);
    expect(result.estimatedProfit).toBeCloseTo(4000, 2); // 20000 * 0.2
  });

  it('never returns below the eBay minimum price floor', () => {
    const cheap: PriceRange[] = [{ id: 'r1', minPrice: 0, maxPrice: 9999, fixedProfitAmount: 0 }];
    const result = calculateListingPrice(0.1, cheap, { ebayFeePercent: 0, fixedFeeAmount: 0 }, 0);
    expect(result.finalPrice).toBeGreaterThanOrEqual(0.99);
    expect(result.breakdown.minPriceFloorApplied).toBe(true);
  });

  it('breaks the final price down into cost + margin + fee line items that sum back to it', () => {
    const result = calculateListingPrice(20, ranges, fees, 8);
    const b = result.breakdown;
    expect(b.amazonPrice).toBe(20);
    expect(b.amazonTaxRatePct).toBe(8);
    expect(b.taxAmount).toBeCloseTo(1.6, 2);
    expect(b.trueCost).toBeCloseTo(21.6, 2);
    expect(b.usedFallbackMargin).toBe(false);
    expect(b.profitMarginPercent).toBe(20);
    expect(b.marginAmount).toBeCloseTo(21.6 * 0.2, 2);
    expect(b.netTarget).toBeCloseTo(b.trueCost + b.marginAmount + b.fixedProfitAmount, 2);
    expect(b.ebayFeePercent).toBe(13);
    expect(b.minPriceFloorApplied).toBe(false);
    // netTarget + fixedFee + ebayFeeAmount reconstructs the pre-floor price.
    expect(b.netTarget + b.fixedFeeAmount + b.ebayFeeAmount).toBeCloseTo(b.priceBeforeFloor, 1);
    expect(b.finalPrice).toBe(result.finalPrice);
  });

  it('flags the fallback margin in the breakdown when no range matches', () => {
    const result = calculateListingPrice(20000, ranges, fees, 0);
    expect(result.breakdown.usedFallbackMargin).toBe(true);
    expect(result.breakdown.profitMarginPercent).toBe(20);
  });
});

describe('applyEbayFees', () => {
  it('falls back instead of dividing by zero when the fee is 100% or more', () => {
    const result = applyEbayFees(50, { ebayFeePercent: 100, fixedFeeAmount: 0 });
    expect(result).toBe(75); // netTarget * 1.5 fallback
  });
});
