import {
  type FeeConfig,
  type PriceRange,
  applyEbayFees,
  applyPriceEnding,
  calculateListingPrice,
  resolvePriceEndingCents,
} from '@repo/shared';

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

describe('price ending', () => {
  const baseFees: FeeConfig = { ebayFeePercent: 13, fixedFeeAmount: 0.3 };
  const ranges: PriceRange[] = [{ id: 'r1', minPrice: 0, maxPrice: 9999, profitMarginPercent: 20 }];

  it('rounds up to the next amount with the ending, in either direction of the cents', () => {
    expect(applyPriceEnding(27.93, 99)).toBe(27.99);
    expect(applyPriceEnding(27.93, 49)).toBe(28.49); // .49 is below .93 → next dollar
    expect(applyPriceEnding(27.31, 35)).toBe(27.35);
    expect(applyPriceEnding(27.31, 0)).toBe(28);
  });

  it('leaves a price that already has the ending untouched', () => {
    expect(applyPriceEnding(19.99, 99)).toBe(19.99);
    expect(applyPriceEnding(1.1, 10)).toBe(1.1); // 1.1 * 100 is 110.00000000000001
    expect(applyPriceEnding(20, 0)).toBe(20);
  });

  it('never lowers the price and adds less than a dollar, for every ending', () => {
    for (let cents = 0; cents <= 99; cents++) {
      for (const price of [0.99, 5.01, 12.5, 27.93, 99.99, 1234.56]) {
        const rounded = applyPriceEnding(price, cents);
        expect(rounded).toBeGreaterThanOrEqual(price);
        expect(rounded - price).toBeLessThan(1);
        expect(Math.round(rounded * 100) % 100).toBe(cents);
      }
    }
  });

  it('is off unless enabled with a usable ending', () => {
    expect(resolvePriceEndingCents(baseFees)).toBeNull();
    expect(resolvePriceEndingCents({ ...baseFees, priceEndingCents: 99 })).toBeNull();
    expect(resolvePriceEndingCents({ ...baseFees, priceRoundingEnabled: true })).toBeNull();
    expect(resolvePriceEndingCents({ ...baseFees, priceRoundingEnabled: true, priceEndingCents: 120 })).toBeNull();
    expect(resolvePriceEndingCents({ ...baseFees, priceRoundingEnabled: true, priceEndingCents: 9.5 })).toBeNull();
    expect(resolvePriceEndingCents({ ...baseFees, priceRoundingEnabled: true, priceEndingCents: 0 })).toBe(0);
  });

  it('changes nothing in the formula while off', () => {
    const off = calculateListingPrice(20, ranges, baseFees, 0);
    expect(off.finalPrice).toBeCloseTo(27.93, 2);
    expect(off.breakdown.priceRoundingApplied).toBe(false);
    expect(off.breakdown.roundingAmount).toBe(0);
  });

  it('applies the ending to the final price and counts the added cents as profit net of the eBay fee', () => {
    const fees: FeeConfig = { ...baseFees, priceRoundingEnabled: true, priceEndingCents: 99 };
    const off = calculateListingPrice(20, ranges, baseFees, 0);
    const on = calculateListingPrice(20, ranges, fees, 0);
    expect(on.finalPrice).toBe(27.99);
    expect(on.breakdown.priceBeforeRounding).toBeCloseTo(27.93, 2);
    expect(on.breakdown.roundingAmount).toBeCloseTo(0.06, 2);
    expect(on.breakdown.priceRoundingApplied).toBe(true);
    // 6 cents more revenue, 13% of it to eBay.
    expect(on.estimatedProfit).toBeCloseTo(off.estimatedProfit + 0.06 * 0.87, 2);
    expect(on.estimatedProfit).toBeGreaterThanOrEqual(off.estimatedProfit);
  });

  it('runs after the minimum-price floor and never undoes it', () => {
    const cheap: PriceRange[] = [{ id: 'r1', minPrice: 0, maxPrice: 9999, fixedProfitAmount: 0 }];
    const fees: FeeConfig = { ebayFeePercent: 0, fixedFeeAmount: 0, priceRoundingEnabled: true, priceEndingCents: 49 };
    const result = calculateListingPrice(0.1, cheap, fees, 0);
    expect(result.finalPrice).toBe(1.49);
  });
});

describe('applyEbayFees', () => {
  it('falls back instead of dividing by zero when the fee is 100% or more', () => {
    const result = applyEbayFees(50, { ebayFeePercent: 100, fixedFeeAmount: 0 });
    expect(result).toBe(75); // netTarget * 1.5 fallback
  });
});

describe('ad rate in the price (spec B5)', () => {
  const strategy = [{ id: 'r1', minPrice: 0, maxPrice: 1000, profitMarginPercent: 20, fixedProfitAmount: 0 }];
  const fees = { ebayFeePercent: 13, fixedFeeAmount: 0.3 } as FeeConfig;

  it('adds the ad rate to the reverse-fee divisor', () => {
    const plain = calculateListingPrice(10, strategy, fees, 0);
    const promoted = calculateListingPrice(10, strategy, fees, 0, 5);
    // (12 + 0.3) / (1 - 0.18) = 15.00
    expect(promoted.finalPrice).toBeCloseTo(15.0, 2);
    expect(promoted.finalPrice).toBeGreaterThan(plain.finalPrice);
    expect(promoted.breakdown.adRatePercent).toBe(5);
    expect(promoted.breakdown.adFeeAmount).toBeCloseTo(0.75, 2);
  });

  it('keeps the seller profit the same as without an ad', () => {
    expect(calculateListingPrice(10, strategy, fees, 0, 5).estimatedProfit).toBe(
      calculateListingPrice(10, strategy, fees, 0).estimatedProfit
    );
  });

  it('a fee + ad rate of 100% or more falls back like a fee alone does', () => {
    const result = calculateListingPrice(10, strategy, { ebayFeePercent: 60, fixedFeeAmount: 0 } as FeeConfig, 0, 40);
    expect(Number.isFinite(result.finalPrice)).toBe(true);
    expect(result.finalPrice).toBeGreaterThan(0);
    // The guard's own fallback: netTarget * 1.5 (no division by a non-positive divisor).
    expect(result.finalPrice).toBeCloseTo(result.breakdown.netTarget * 1.5, 2);
  });

  it('the price-ending profit term deducts the ad rate too (x0.82, not x0.87)', () => {
    const rounding = { ebayFeePercent: 13, fixedFeeAmount: 0.3, priceRoundingEnabled: true, priceEndingCents: 99 } as FeeConfig;
    const base = calculateListingPrice(10, strategy, fees, 0, 5).estimatedProfit;
    const rounded = calculateListingPrice(10, strategy, rounding, 0, 5);
    expect(rounded.breakdown.roundingAmount).toBeGreaterThan(0.9);
    expect(rounded.estimatedProfit).toBeCloseTo(base + rounded.breakdown.roundingAmount * 0.82, 2);
  });

  it('no ad rate is the old formula exactly', () => {
    expect(calculateListingPrice(10, strategy, fees, 0, 0)).toEqual(calculateListingPrice(10, strategy, fees, 0));
  });
});
