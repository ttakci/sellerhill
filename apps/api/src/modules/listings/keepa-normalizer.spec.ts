import { KeepaStockStatus } from '@repo/shared';

import {
  AMAZON_SELLER_ID,
  chunkAsins,
  dedupeAsins,
  extractCategoryPath,
  extractCommerce,
  extractImageUrls,
  latestStockFromCsv,
  liveOffers,
  type KeepaRawProduct,
} from './keepa-normalizer';

/**
 * Fixtures are modeled 1:1 on live Keepa /product responses captured 2026-07-28
 * with `history=0&stats=90&offers=20&only-live-offers=1&stock=1` (domain 1):
 * - Amazon-buy-box product: buyBoxSellerId=ATVPDKIKX0DER, stockBuyBox=1000,
 *   offer[0].stockCSV=[...,8183354,1000], tokensConsumed varied 0..6.
 * - FBM single-offer product: buyBoxPrice=599, buyBoxShipping=199,
 *   stockCSV=[8051336,500,8068064,499], stats.stockBuyBox absent.
 * - Dead ASIN: stats.buyBoxPrice=-2 (sentinel), current all -1, no offers.
 */

const amazonBuyBoxProduct: KeepaRawProduct = {
  asin: 'B01NBKTPTS',
  title: 'Instant Pot Duo Plus',
  offersSuccessful: true,
  liveOffersOrder: [0, 1],
  offers: [
    {
      sellerId: AMAZON_SELLER_ID,
      isAmazon: true,
      isFBA: true,
      condition: 1,
      lastSeen: 8189870,
      stockCSV: [8180730, 6, 8181592, 5, 8183354, 1000],
    },
    {
      sellerId: 'A2THIRDPARTY',
      isFBA: true,
      condition: 5,
      lastSeen: 8189870,
      stockCSV: [8185304, 22, 8189620, 2],
    },
  ],
  stats: {
    buyBoxPrice: 13999,
    buyBoxShipping: 0,
    buyBoxSellerId: AMAZON_SELLER_ID,
    buyBoxIsAmazon: true,
    stockBuyBox: 1000,
    stockAmazon: 1000,
    totalOfferCount: 19,
    current: [13999, 13999],
  },
};

const fbmSingleOfferProduct: KeepaRawProduct = {
  asin: 'B0GXW9JM92',
  title: 'Crunchy Stress Ball',
  offersSuccessful: true,
  liveOffersOrder: [0],
  offers: [
    {
      sellerId: 'A1FBMSELLER',
      isFBA: false,
      condition: 1,
      lastSeen: 8071932,
      stockCSV: [8051336, 500, 8068064, 499],
    },
  ],
  stats: {
    buyBoxPrice: 599,
    buyBoxShipping: 199,
    buyBoxSellerId: 'A1FBMSELLER',
    current: [-1, 798],
  },
};

const deadProduct: KeepaRawProduct = {
  asin: 'B08N5WRWNW',
  offersSuccessful: true,
  liveOffersOrder: [],
  offers: [],
  stats: {
    buyBoxPrice: -2,
    buyBoxShipping: -2,
    current: [-1, -1],
  },
};

describe('extractCommerce', () => {
  it('reads Buy Box price incl. shipping and matches the Buy Box offer stock', () => {
    const c = extractCommerce(fbmSingleOfferProduct);
    expect(c.price).toBeCloseTo(7.98); // 599 + 199 cents
    expect(c.stock).toBe(499); // last stockCSV pair
    expect(c.stockStatus).toBe(KeepaStockStatus.KNOWN);
    expect(c.sellerId).toBe('A1FBMSELLER');
    expect(c.buyBoxIsAmazon).toBeUndefined();
  });

  it('detects Amazon as Buy Box holder and uses its offer stock observation', () => {
    const c = extractCommerce(amazonBuyBoxProduct);
    expect(c.price).toBeCloseTo(139.99);
    expect(c.stock).toBe(1000); // Amazon caps reporting at 1000
    expect(c.stockStatus).toBe(KeepaStockStatus.KNOWN);
    expect(c.buyBoxIsAmazon).toBe(true);
  });

  it('falls back to stats.stockBuyBox when the Buy Box offer has no stockCSV', () => {
    const product: KeepaRawProduct = {
      ...amazonBuyBoxProduct,
      offers: [{ sellerId: AMAZON_SELLER_ID, condition: 1 }],
      liveOffersOrder: [0],
    };
    const c = extractCommerce(product);
    expect(c.stock).toBe(1000);
    expect(c.stockStatus).toBe(KeepaStockStatus.KNOWN);
  });

  it('treats -1/-2 price sentinels as no-price, never 0 or negative', () => {
    const c = extractCommerce(deadProduct);
    expect(c.price).toBeNull();
  });

  it('confirms OUT_OF_STOCK only when live-offer retrieval succeeded and none exist', () => {
    const c = extractCommerce(deadProduct);
    expect(c.stock).toBe(0);
    expect(c.stockStatus).toBe(KeepaStockStatus.OUT_OF_STOCK);
  });

  it('returns UNKNOWN (not 0) when offers were not retrieved', () => {
    const product: KeepaRawProduct = {
      asin: 'B000UNKNOWN',
      // no offersSuccessful, no liveOffersOrder → offer retrieval not confirmed
      stats: { buyBoxPrice: -2, current: [-1, -1] },
    };
    const c = extractCommerce(product);
    expect(c.stock).toBeNull();
    expect(c.stockStatus).toBe(KeepaStockStatus.UNKNOWN);
  });

  it('returns UNKNOWN when a price exists but no stock observation does', () => {
    const product: KeepaRawProduct = {
      asin: 'B000PRICEONLY',
      offersSuccessful: true,
      liveOffersOrder: [0],
      offers: [{ sellerId: 'A1NOSTOCK', condition: 1 }],
      stats: { buyBoxPrice: 2479, buyBoxShipping: -2, buyBoxSellerId: 'A1NOSTOCK' },
    };
    const c = extractCommerce(product);
    expect(c.price).toBeCloseTo(24.79);
    expect(c.stock).toBeNull();
    expect(c.stockStatus).toBe(KeepaStockStatus.UNKNOWN);
  });

  it('never uses totalOfferCount as a stock quantity', () => {
    const product: KeepaRawProduct = {
      asin: 'B000OFFERCOUNT',
      offersSuccessful: true,
      liveOffersOrder: [0],
      offers: [{ sellerId: 'A1SELLER', condition: 1 }],
      stats: {
        buyBoxPrice: 1000,
        buyBoxSellerId: 'A1SELLER',
        totalOfferCount: 19,
      },
    };
    const c = extractCommerce(product);
    expect(c.stock).not.toBe(19);
    expect(c.stockStatus).toBe(KeepaStockStatus.UNKNOWN);
  });

  it('uses stats.current[18] (Buy Box) before NEW and AMAZON fallbacks', () => {
    const product: KeepaRawProduct = {
      asin: 'B000FALLBACK',
      stats: {
        buyBoxPrice: -2,
        current: [1100, 1200, ...Array.from({ length: 16 }, () => -1), 1050],
      },
    };
    expect(extractCommerce(product).price).toBeCloseTo(10.5);
  });
});

describe('latestStockFromCsv', () => {
  it('returns the qty of the last [time, qty] pair', () => {
    expect(latestStockFromCsv([8051336, 500, 8068064, 499])).toBe(499);
  });
  it('rejects odd-length or empty arrays', () => {
    expect(latestStockFromCsv([8051336, 500, 8068064])).toBeNull();
    expect(latestStockFromCsv([])).toBeNull();
    expect(latestStockFromCsv(undefined)).toBeNull();
  });
});

describe('liveOffers', () => {
  it('resolves offers through liveOffersOrder indices', () => {
    const offers = liveOffers(amazonBuyBoxProduct);
    expect(offers).toHaveLength(2);
    expect(offers[0].sellerId).toBe(AMAZON_SELLER_ID);
  });
  it('falls back to all offers when liveOffersOrder is null', () => {
    const product = { ...amazonBuyBoxProduct, liveOffersOrder: null };
    expect(liveOffers(product)).toHaveLength(2);
  });
});

describe('extractImageUrls', () => {
  it('prefers the modern images array (large size)', () => {
    const urls = extractImageUrls({
      images: [{ l: '71nx65qZq6L.jpg', m: '41QhAGJgC8L.jpg' }, { m: 'medium-only.jpg' }],
    });
    expect(urls).toEqual([
      'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg',
      'https://images-na.ssl-images-amazon.com/images/I/medium-only.jpg',
    ]);
  });
  it('falls back to legacy imagesCSV', () => {
    expect(extractImageUrls({ imagesCSV: 'a.jpg,b.jpg' })).toHaveLength(2);
  });
  it('returns [] when neither is present (live responses can null imagesCSV)', () => {
    expect(extractImageUrls({ imagesCSV: null })).toEqual([]);
  });
});

describe('extractCategoryPath', () => {
  it('joins the whole tree root-to-leaf', () => {
    expect(
      extractCategoryPath({
        categoryTree: [
          { name: 'Home & Kitchen' },
          { name: 'Kitchen & Dining' },
          { name: 'Coffee, Tea & Espresso' },
          { name: 'Espresso Machines' },
        ],
      } as KeepaRawProduct)
    ).toBe('Home & Kitchen > Kitchen & Dining > Coffee, Tea & Espresso > Espresso Machines');
  });

  it('distinguishes identically-named leaves under different departments', () => {
    // The reason the mapping is keyed on the path and not the leaf: caching
    // "Accessories -> some eBay category" would mis-file an entire niche.
    const electronics = extractCategoryPath({
      categoryTree: [{ name: 'Electronics' }, { name: 'Accessories' }],
    } as KeepaRawProduct);
    const automotive = extractCategoryPath({
      categoryTree: [{ name: 'Automotive' }, { name: 'Accessories' }],
    } as KeepaRawProduct);

    expect(electronics).not.toBe(automotive);
  });

  it('drops blank nodes rather than emitting empty segments', () => {
    expect(
      extractCategoryPath({ categoryTree: [{ name: 'Toys' }, { name: '  ' }, { name: 'Puzzles' }] } as KeepaRawProduct)
    ).toBe('Toys > Puzzles');
  });

  it('returns undefined when Keepa sent no tree', () => {
    expect(extractCategoryPath({} as KeepaRawProduct)).toBeUndefined();
    expect(extractCategoryPath({ categoryTree: [] } as unknown as KeepaRawProduct)).toBeUndefined();
  });
});

describe('dedupeAsins / chunkAsins', () => {
  it('dedupes preserving order and drops blanks', () => {
    expect(dedupeAsins(['B01', 'B02', 'B01', ' ', 'B03'])).toEqual(['B01', 'B02', 'B03']);
  });
  it('chunks at the Keepa 100-ASIN request limit', () => {
    const asins = Array.from({ length: 250 }, (_, i) => `B${i}`);
    const chunks = chunkAsins(asins, 100);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunks.flat()).toEqual(asins);
  });
  it('handles 0, 1, 100 boundary sizes', () => {
    expect(chunkAsins([], 100)).toEqual([]);
    expect(chunkAsins(['B01'], 100)).toEqual([['B01']]);
    expect(chunkAsins(Array.from({ length: 100 }, () => 'B'), 100)).toHaveLength(1);
  });
});
