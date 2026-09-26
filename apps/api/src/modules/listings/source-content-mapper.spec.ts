import { AmazonMarketplace, SourceStockStatus, type ScraperContent, type SourceCommerce } from '@repo/shared';

import { mapScraperIdentifiers, mapScraperProduct, translateScraperSpecs } from './source-content-mapper';

const content = (over: Partial<ScraperContent> = {}): ScraperContent => ({
  title: 'Mobil 1 Extended Performance Oil Filter, M1-113A | 2 Pack', brand: 'Mobil', manufacturer: 'Mobil 1',
  bullets: ['a', 'b'], description: 'desc', aplusRaw: 'Add to Cart $14.99',
  images: ['https://m.media-amazon.com/images/I/313tiIJ6ZyL._AC_SL1500_.jpg'],
  categories: ['Automotive', 'Replacement Parts', 'Filters', 'Oil Filters & Accessories', 'Oil Filters'],
  specs: {
    brand_name: 'Mobil', material_type: 'Stainless Steel, Synthetic', color: 'Blue', item_weight: '0.07 kg',
    number_of_items: '2', thread_size: 'M22 x 1.50', upc: '071924414402', asin: 'B077PVLBZ4',
    customer_reviews: '4.8', best_sellers_rank: '#8,656', date_first_available: 'Jan 1',
    manufacturer_part_number: 'M1-113A-2PK', model_number: 'M1-113A-2PK',
  },
  identifiers: { upc: '071924414402', gtin: '00071924414402', model_number: 'M1-113A-2PK', part_number: 'M1-113A-2PK' },
  ...over,
});
const commerce: SourceCommerce = { price: 26, stockStatus: SourceStockStatus.AT_LEAST, stock: 20, maxOrderQuantity: 30, removed: false };

describe('translateScraperSpecs', () => {
  it('maps known keys to the canonical names the aspect matcher uses', () => {
    const s = translateScraperSpecs(content().specs);
    expect(s).toMatchObject({ Brand: 'Mobil', Material: 'Stainless Steel, Synthetic', Color: 'Blue', 'Item Weight': '0.07 kg', 'Number of Items': '2' });
  });
  it('Title-Cases unknown keys so they still reach eBay as custom specifics', () => {
    expect(translateScraperSpecs(content().specs)['Thread Size']).toBe('M22 x 1.50');
  });
  it('drops noise and identifier keys', () => {
    const s = translateScraperSpecs(content().specs);
    for (const k of ['Asin', 'ASIN', 'Customer Reviews', 'Best Sellers Rank', 'Date First Available', 'Upc', 'UPC', 'Manufacturer Part Number', 'Model Number']) {
      expect(s[k]).toBeUndefined();
    }
  });
  it('drops empty values', () => {
    expect(translateScraperSpecs({ color: '  ' })).toEqual({});
  });
});

describe('mapScraperIdentifiers', () => {
  it('keeps a valid UPC and moves part number to MPN', () => {
    expect(mapScraperIdentifiers(content().identifiers, 'Mobil')).toMatchObject({ upc: '071924414402', mpn: 'M1-113A-2PK', model: 'M1-113A-2PK' });
  });
  it('turns a 13-digit GTIN into an EAN', () => {
    expect(mapScraperIdentifiers({ gtin: '4006381333931' }, null)).toMatchObject({ ean: '4006381333931' });
  });
  it('drops a barcode-shaped part number and an invalid UPC', () => {
    expect(mapScraperIdentifiers({ part_number: '071924414402', upc: '123' }, null)).toEqual({});
  });
  it('accepts no barcode at all', () => {
    expect(mapScraperIdentifiers({}, 'Mobil')).toEqual({});
  });
});

describe('mapScraperProduct', () => {
  it('builds ProductData with the path Keepa would build', () => {
    const p = mapScraperProduct('B077PVLBZ4', content(), commerce, AmazonMarketplace.AMAZON_US);
    expect(p.categoryPath).toBe('Automotive > Replacement Parts > Filters > Oil Filters & Accessories > Oil Filters');
    expect(p.category).toBe('Oil Filters');
    expect(p.price).toEqual({ current: 26, currency: 'USD' });
    expect(p.stock).toBe(20);
    expect(p.stockStatus).toBe(SourceStockStatus.AT_LEAST);
    expect(p.maxOrderQuantity).toBe(30);
    expect(p.features).toEqual(['a', 'b']);
    expect(p.imageUrls).toHaveLength(1);
  });
  it('never uses A+ text as the description', () => {
    expect(mapScraperProduct('B077PVLBZ4', content({ description: null }), commerce, AmazonMarketplace.AMAZON_US).description).toBe('');
  });
  it('stores raw content including A+ for later', () => {
    const p = mapScraperProduct('B077PVLBZ4', content(), commerce, AmazonMarketplace.AMAZON_US);
    expect((p.raw as { content: ScraperContent }).content.aplusRaw).toBe('Add to Cart $14.99');
  });
  it('UNKNOWN stock on create persists as out of stock 0', () => {
    const p = mapScraperProduct('B077PVLBZ4', content(), { ...commerce, stockStatus: SourceStockStatus.UNKNOWN, stock: null }, AmazonMarketplace.AMAZON_US);
    expect(p.stock).toBe(0);
    expect(p.stockStatus).toBe(SourceStockStatus.OUT_OF_STOCK);
  });
});
