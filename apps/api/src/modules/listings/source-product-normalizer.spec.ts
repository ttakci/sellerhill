import { SourceFetchOutcome, SourceStockStatus, type ScraperProductResult, type ScraperSignals } from '@repo/shared';

import { normalizeScraperCommerce } from './source-product-normalizer';

const signals = (over: Partial<ScraperSignals> = {}): ScraperSignals => ({
  price: 12.5, currency: 'USD', availabilityText: 'In Stock', isInStock: true, onlyLeft: null,
  quantityMax: 30, buyboxSellerId: 'S', buyboxSellerName: 'Seller', soldByAmazon: false, ...over,
});
const found = (s: ScraperSignals): ScraperProductResult => ({
  asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals: s, content: null,
});

describe('normalizeScraperCommerce', () => {
  it('Only N left → EXACT N', () => {
    const r = normalizeScraperCommerce(found(signals({ onlyLeft: 7, quantityMax: 30 })), 20);
    expect(r).toEqual({ kind: 'observed', commerce: { price: 12.5, stockStatus: SourceStockStatus.EXACT, stock: 7, maxOrderQuantity: 30, removed: false } });
  });

  it('In Stock with default dropdown → AT_LEAST floor', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: 30 })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.AT_LEAST, stock: 20, maxOrderQuantity: 30 } });
  });

  it('In Stock with no dropdown → AT_LEAST floor, no order limit', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: null })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.AT_LEAST, stock: 20, maxOrderQuantity: null } });
  });

  it('In Stock with seller limit below floor → AT_LEAST limit', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: 4 })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.AT_LEAST, stock: 4, maxOrderQuantity: 4 } });
  });

  it('floor is configurable', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: 30 })), 25);
    expect(r).toMatchObject({ commerce: { stock: 25 } });
  });

  it('Currently unavailable → OUT_OF_STOCK 0 even with a stale price', () => {
    const r = normalizeScraperCommerce(found(signals({ isInStock: false, availabilityText: 'Currently unavailable.', price: null })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, price: null } });
  });

  it('404 → OUT_OF_STOCK 0 and removed', () => {
    const r = normalizeScraperCommerce({ asin: 'B000000001', outcome: SourceFetchOutcome.NOT_FOUND, fetchedAt: 't', signals: null, content: null }, 20);
    expect(r).toEqual({ kind: 'observed', commerce: { price: null, stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, maxOrderQuantity: null, removed: true } });
  });

  it('in stock with no readable price → price null (never 0)', () => {
    const r = normalizeScraperCommerce(found(signals({ price: null })), 20);
    expect(r).toMatchObject({ kind: 'observed', commerce: { price: null, stockStatus: SourceStockStatus.AT_LEAST } });
  });

  it('availability unknown but price present → UNKNOWN stock, price kept', () => {
    const r = normalizeScraperCommerce(found(signals({ isInStock: null, availabilityText: null })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.UNKNOWN, stock: null, price: 12.5 } });
  });

  it('neither price nor availability → data failure', () => {
    expect(normalizeScraperCommerce(found(signals({ isInStock: null, availabilityText: null, price: null })), 20)).toEqual({ kind: 'data_failure' });
  });

  it('parse_failed → data failure; blocked / no_proxy → transport', () => {
    const base = { asin: 'B000000001', fetchedAt: null, signals: null, content: null };
    expect(normalizeScraperCommerce({ ...base, outcome: SourceFetchOutcome.PARSE_FAILED }, 20)).toEqual({ kind: 'data_failure' });
    expect(normalizeScraperCommerce({ ...base, outcome: SourceFetchOutcome.BLOCKED }, 20)).toEqual({ kind: 'transport' });
    expect(normalizeScraperCommerce({ ...base, outcome: SourceFetchOutcome.NO_PROXY }, 20)).toEqual({ kind: 'transport' });
  });

  it('found with null signals → data failure', () => {
    expect(normalizeScraperCommerce({ asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals: null, content: null }, 20)).toEqual({ kind: 'data_failure' });
  });
});
