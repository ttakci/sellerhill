import { KeepaStockStatus, SourceFetchOutcome, SourceStockStatus, type ScraperProductResult } from '@repo/shared';

import { keepaStockStatusToSource, planKeepaRollback, planScraperRefresh, resolveScraperRefreshBatchSize } from './scraper-refresh';

const row = { price: 10, stock: 20, stockStatus: SourceStockStatus.AT_LEAST, maxOrderQuantity: 30, removed: false };
const found = (over = {}): ScraperProductResult => ({
  asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', content: null,
  signals: { price: 10, currency: 'USD', availabilityText: 'In Stock', isInStock: true, onlyLeft: null, quantityMax: 30,
    buyboxSellerId: null, buyboxSellerName: null, soldByAmazon: null, ...over },
});

describe('resolveScraperRefreshBatchSize', () => {
  it('rate × proxies × 60 × (1 − reserve), floored and clamped', () => {
    expect(resolveScraperRefreshBatchSize({ proxyCount: 5, perIpRequestsPerSecond: 1, reservePercent: 20, min: 1, max: 1000 })).toBe(240);
    expect(resolveScraperRefreshBatchSize({ proxyCount: 0, perIpRequestsPerSecond: 1, reservePercent: 20, min: 1, max: 1000 })).toBe(1);
    expect(resolveScraperRefreshBatchSize({ proxyCount: 50, perIpRequestsPerSecond: 10, reservePercent: 0, min: 1, max: 1000 })).toBe(1000);
  });
});

describe('planScraperRefresh', () => {
  it('missing, blocked or no-proxy result → skip (lease expiry retries)', () => {
    expect(planScraperRefresh(row, undefined, 20)).toEqual({ kind: 'skip' });
    expect(planScraperRefresh(row, { ...found(), outcome: SourceFetchOutcome.BLOCKED, signals: null }, 20)).toEqual({ kind: 'skip' });
  });
  it('parse failure → data_failure', () => {
    expect(planScraperRefresh(row, { ...found(), outcome: SourceFetchOutcome.PARSE_FAILED, signals: null }, 20)).toEqual({ kind: 'data_failure' });
  });
  it('same state → observed, no commerce change', () => {
    expect(planScraperRefresh(row, found(), 20)).toMatchObject({ kind: 'observed', commerceChanged: false });
  });
  it('stock drop to Only 3 left → change', () => {
    expect(planScraperRefresh(row, found({ onlyLeft: 3 }), 20)).toMatchObject({ stock: 3, stockStatus: SourceStockStatus.EXACT, commerceChanged: true });
  });
  it('order limit change alone → change (it moves the listed quantity)', () => {
    expect(planScraperRefresh(row, found({ quantityMax: 4 }), 20)).toMatchObject({ maxOrderQuantity: 4, commerceChanged: true });
  });
  it('status-only change (EXACT 20 → AT_LEAST 20) → no fan-out', () => {
    expect(planScraperRefresh({ ...row, stockStatus: SourceStockStatus.EXACT }, found(), 20)).toMatchObject({ stockStatus: SourceStockStatus.AT_LEAST, commerceChanged: false });
  });
  it('missing price keeps the previous price', () => {
    expect(planScraperRefresh(row, found({ price: null }), 20)).toMatchObject({ price: 10, commerceChanged: false });
  });
  it('an in-stock observation with a null price never plans a price of 0', () => {
    const inStockNoPrice = planScraperRefresh(row, found({ price: null, onlyLeft: 3 }), 20);
    expect(inStockNoPrice).toMatchObject({ kind: 'observed', price: 10, stock: 3 });
    // A row with no stored price stays null (the UPDATE keeps the column), never 0.
    const noStored = planScraperRefresh({ ...row, price: null }, found({ price: null }), 20);
    expect(noStored).toMatchObject({ kind: 'observed', price: null });
    expect(planScraperRefresh(row, found({ price: 0 }), 20)).toMatchObject({ price: 10 });
  });
  it('404 → stock 0, removed, change', () => {
    expect(planScraperRefresh(row, { ...found(), outcome: SourceFetchOutcome.NOT_FOUND, signals: null }, 20)).toMatchObject({ stock: 0, removed: true, commerceChanged: true });
  });
  it('coming back after 404 clears removed', () => {
    expect(planScraperRefresh({ ...row, stock: 0, removed: true, stockStatus: SourceStockStatus.OUT_OF_STOCK }, found(), 20)).toMatchObject({ removed: false, stock: 20, commerceChanged: true });
  });
  it('UNKNOWN keeps previous stock, status and limit', () => {
    expect(planScraperRefresh(row, found({ isInStock: null, availabilityText: null }), 20)).toMatchObject({ stock: 20, stockStatus: null, keepMaxOrderQuantity: true, commerceChanged: false });
  });
});

describe('keepaStockStatusToSource (rollback path)', () => {
  it('KNOWN → exact, OUT_OF_STOCK → out_of_stock, UNKNOWN → null (keep)', () => {
    expect(keepaStockStatusToSource(KeepaStockStatus.KNOWN)).toBe(SourceStockStatus.EXACT);
    expect(keepaStockStatusToSource(KeepaStockStatus.OUT_OF_STOCK)).toBe(SourceStockStatus.OUT_OF_STOCK);
    expect(keepaStockStatusToSource(KeepaStockStatus.UNKNOWN)).toBeNull();
  });
});

describe('planKeepaRollback', () => {
  it('KNOWN clears scraper state and fans out once when a cap existed', () => {
    expect(planKeepaRollback(KeepaStockStatus.KNOWN, 4)).toEqual({
      clearScraperState: true,
      stockStatus: SourceStockStatus.EXACT,
      commerceChangedByRollback: true,
    });
  });
  it('OUT_OF_STOCK clears scraper state, but no cap to remove means no extra fan-out', () => {
    expect(planKeepaRollback(KeepaStockStatus.OUT_OF_STOCK, null)).toEqual({
      clearScraperState: true,
      stockStatus: SourceStockStatus.OUT_OF_STOCK,
      commerceChangedByRollback: false,
    });
  });
  it('UNKNOWN leaves scraper-era state untouched, even with a stored cap', () => {
    expect(planKeepaRollback(KeepaStockStatus.UNKNOWN, 4)).toEqual({
      clearScraperState: false,
      stockStatus: null,
      commerceChangedByRollback: false,
    });
  });
});
