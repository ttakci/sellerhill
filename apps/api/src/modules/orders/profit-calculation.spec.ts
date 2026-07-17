import { OrderCostCaptureStatus } from '@repo/shared';

import {
  computeNetProfit,
  deriveCostCaptureStatus,
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
