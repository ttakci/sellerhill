import { AmazonMarketplace, SourceStockStatus, type ScraperContent, type SourceCommerce } from '@repo/shared';

import {
  buildScraperSpecs,
  mapScraperIdentifiers,
  mapScraperProduct,
  parseDimensionsCell,
  parseWeightCell,
  translateScraperSpecs,
} from './source-content-mapper';

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
  // provider:compare 2026-09-27, B0784BFHMQ: the page lists several barcodes in
  // one cell ("071924213920 071924414518" / "00071924213920, 00071924414518").
  // The whole cell failed the check digit, so the product lost a UPC Keepa had.
  it('takes the first valid barcode from a multi-value cell', () => {
    expect(
      mapScraperIdentifiers({ upc: '071924213920 071924414518', gtin: '00071924213920, 00071924414518' }, null),
    ).toMatchObject({ upc: '071924213920' });
    expect(mapScraperIdentifiers({ gtin: 'bogus, 4006381333931' }, null)).toMatchObject({ ean: '4006381333931' });
  });
});

describe('parseDimensionsCell / parseWeightCell', () => {
  it('splits Amazon L x W x H cells into Keepa-formatted inches', () => {
    expect(parseDimensionsCell('5.91 x 5.91 x 11.81 inches')).toEqual({ length: '5.9 in', width: '5.9 in', height: '11.8 in' });
    expect(parseDimensionsCell('8.43 x 5.04 x 4.92 inches; 1.72 pounds')).toEqual({ length: '8.4 in', width: '5 in', height: '4.9 in', weight: '1.72 lbs' });
    expect(parseDimensionsCell('10 x 20 cm')).toEqual({ length: '3.9 in', width: '7.9 in' });
  });
  it('honours explicit axis letters', () => {
    expect(parseDimensionsCell('13"L x 3"W')).toEqual({ length: '13 in', width: '3 in' });
    expect(parseDimensionsCell('12"W x 8"H x 4"D')).toEqual({ width: '12 in', height: '8 in' });
  });
  it('yields nothing for prose or a missing unit', () => {
    expect(parseDimensionsCell('Fits most cars')).toEqual({});
    expect(parseDimensionsCell('5 x 7')).toEqual({});
    expect(parseDimensionsCell(undefined)).toEqual({});
  });
  it('normalises page weights to Keepa\'s oz/lbs spelling', () => {
    expect(parseWeightCell('2.88 ounces')).toBe('2.9 oz');
    expect(parseWeightCell('680 g')).toBe('1.5 lbs');
    expect(parseWeightCell('1.72 pounds')).toBe('1.72 lbs');
    expect(parseWeightCell('heavy')).toBeUndefined();
  });
});

describe('buildScraperSpecs', () => {
  // provider:compare 2026-09-27 (50 ASINs): Brand, Model/MPN, Color/Size/Scent
  // and Item Length/Width/Height were on the page but never reached specs, so
  // 27 of 50 products carried fewer item specifics than Keepa gave them.
  it('adds brand, identifiers, twister selection and per-axis dimensions the page carries elsewhere', () => {
    const c = content({
      specs: { item_dimensions: '2.75 x 2.75 x 3.5 inches; 7 ounces', package_dimensions: '4 x 4 x 4 inches' },
      variationAttributes: { Scent: 'Unscented', Size: '90 Count (Pack of 1)' },
    });
    const s = buildScraperSpecs(c, mapScraperIdentifiers(c.identifiers, c.brand));
    expect(s).toMatchObject({
      Brand: 'Mobil', Manufacturer: 'Mobil 1', Model: 'M1-113A-2PK', MPN: 'M1-113A-2PK',
      Scent: 'Unscented', Size: '90 Count (Pack of 1)',
      'Item Length': '2.8 in', 'Item Width': '2.8 in', 'Item Height': '3.5 in', 'Item Weight': '7 oz',
      'Item Dimensions': '2.75 x 2.75 x 3.5 inches; 7 ounces',
    });
  });
  it('never overwrites what the page table already said', () => {
    const c = content({ specs: { brand: 'PageBrand', color: 'Blue', item_weight: '680 g' }, variationAttributes: { Color: 'Red' } });
    const s = buildScraperSpecs(c, {});
    expect(s.Brand).toBe('PageBrand');
    expect(s.Color).toBe('Blue');
    expect(s['Item Weight']).toBe('1.5 lbs');
  });
  it('falls back to the package cell only for weight, never for item dimensions', () => {
    const s = buildScraperSpecs(content({ specs: { package_dimensions: '8.43 x 5.04 x 4.92 inches; 1.72 pounds' }, identifiers: {} }), {});
    expect(s['Item Length']).toBeUndefined();
    expect(s['Item Weight']).toBe('1.72 lbs');
  });
  it('tolerates a service build without variationAttributes', () => {
    const c = content({ identifiers: {} });
    delete (c as Partial<ScraperContent>).variationAttributes;
    expect(() => buildScraperSpecs(c, {})).not.toThrow();
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
    expect(p.specs).toMatchObject({ Brand: 'Mobil', MPN: 'M1-113A-2PK' });
    expect(p.identifiers).toMatchObject({ upc: '071924414402', mpn: 'M1-113A-2PK' });
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
