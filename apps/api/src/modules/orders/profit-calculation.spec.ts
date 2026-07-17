import { OrderCostCaptureStatus } from '@repo/shared';

import {
  computeNetProfit,
  deriveCostCaptureStatus,
  deriveProfitBasis,
  estimateProvisionalNetProfit,
} from './profit-calculation';

describe('computeNetProfit', () => {
  it('returns full formula when all costs known', () => {
    expect(
      computeNetProfit({ ebayEarnings: 100, purchasePrice: 60, amazonTax: 5, amazonShipping: 5 }),
    ).toBe(30);
  });

  it('rounds to 2 decimals', () => {
    expect(
      computeNetProfit({ ebayEarnings: 10, purchasePrice: 3.333, amazonTax: 0, amazonShipping: 0 }),
    ).toBe(6.67);
  });

  it('returns null when purchase price unknown (<= 0 means unknown here)', () => {
    expect(
      computeNetProfit({ ebayEarnings: 100, purchasePrice: 0, amazonTax: 0, amazonShipping: 0 }),
    ).toBeNull();
  });
});

describe('deriveCostCaptureStatus', () => {
  const T = { hasListingMatch: true, asinResolved: true, amazonLinked: false, amazonCostsCaptured: false, scrapeFailed: false };

  it('linked when amazon costs captured', () => {
    expect(deriveCostCaptureStatus({ ...T, amazonLinked: true, amazonCostsCaptured: true }))
      .toBe(OrderCostCaptureStatus.LINKED);
  });

  it('failed when a scrape ran but produced nothing', () => {
    expect(deriveCostCaptureStatus({ ...T, scrapeFailed: true }))
      .toBe(OrderCostCaptureStatus.FAILED);
  });

  it('untracked when no listing and no asin', () => {
    expect(deriveCostCaptureStatus({ ...T, hasListingMatch: false, asinResolved: false }))
      .toBe(OrderCostCaptureStatus.UNTRACKED);
  });

  it('provisional when product cost known but amazon not linked', () => {
    expect(deriveCostCaptureStatus({ ...T, amazonLinked: false }))
      .toBe(OrderCostCaptureStatus.PROVISIONAL);
  });
});

describe('estimateProvisionalNetProfit', () => {
  it('returns null when purchase price unknown', () => {
    expect(estimateProvisionalNetProfit({ ebayEarnings: 100, purchasePrice: 0, amazonTaxRatePct: 7 })).toBeNull();
  });
  it('subtracts estimated Amazon tax (on purchase price)', () => {
    // 100 - 60 - (60 * 0.07) = 100 - 60 - 4.2 = 35.8
    expect(estimateProvisionalNetProfit({ ebayEarnings: 100, purchasePrice: 60, amazonTaxRatePct: 7 })).toBe(35.8);
  });
  it('tax rate 0 -> no tax deducted', () => {
    expect(estimateProvisionalNetProfit({ ebayEarnings: 100, purchasePrice: 60, amazonTaxRatePct: 0 })).toBe(40);
  });
  it('rounds to 2 decimals', () => {
    expect(estimateProvisionalNetProfit({ ebayEarnings: 50, purchasePrice: 33.333, amazonTaxRatePct: 7 })).toBe(14.33);
  });
});

describe('deriveProfitBasis', () => {
  it("returns 'confirmed' for LINKED", () => {
    expect(deriveProfitBasis(OrderCostCaptureStatus.LINKED)).toBe('confirmed');
  });
  it("returns 'estimated' for PROVISIONAL", () => {
    expect(deriveProfitBasis(OrderCostCaptureStatus.PROVISIONAL)).toBe('estimated');
  });
  it("returns null for PENDING (neither confirmed nor estimated)", () => {
    expect(deriveProfitBasis(OrderCostCaptureStatus.PENDING)).toBeNull();
  });
  it("returns null for FAILED", () => {
    expect(deriveProfitBasis(OrderCostCaptureStatus.FAILED)).toBeNull();
  });
  it("returns null for UNTRACKED", () => {
    expect(deriveProfitBasis(OrderCostCaptureStatus.UNTRACKED)).toBeNull();
  });
});
