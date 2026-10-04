import { DEFAULT_LISTING_RULES, ListingFailureCode, TemplateType, type ListingSettingsGroup, type ProductData } from '@repo/shared';

import { classifyListingFailure } from './listing-failure';
import { ListingStrategyService, SourcePriceUnavailableError } from './listing-strategy.service';

/**
 * A live listing is never priced from an unknown or 0 Amazon price.
 *
 * Pricing from 0 yields fees + fixed profit (or the price floor), so every sale
 * would buy the item on Amazon at full price. Provider-neutral: the scraper can
 * read "In Stock" with an unreadable price block, and Keepa maps a missing Buy
 * Box price to 0. A draft may still be saved.
 */
describe('ListingStrategyService — non-positive source price', () => {
  const product = (current: number): ProductData =>
    ({
      asin: 'B0C1HJV7BJ',
      title: 'Headphones',
      brand: 'Brand',
      description: 'd',
      features: [],
      specs: {},
      identifiers: {},
      imageUrls: ['https://example.com/a.jpg'],
      price: { current, currency: 'USD' },
      stock: 20,
    }) as unknown as ProductData;

  const group = {
    id: 'group-1',
    templates: { type: TemplateType.CUSTOM, customTemplateHtml: '<p class="t">{{title}}</p>' },
    content: {},
    listingRules: DEFAULT_LISTING_RULES,
    stock: { defaultQuantity: 5, stockBuffer: 0 },
    repricingStrategy: [{ id: 'r1', minPrice: 0, maxPrice: 9999, profitMarginPercent: 20 }],
    fees: { ebayFeePercent: 13, fixedFeeAmount: 0.3 },
  } as unknown as ListingSettingsGroup;

  const service = new ListingStrategyService(
    { getListingSettingsGroupById: jest.fn().mockResolvedValue(group) } as never,
    { getResolvedSettings: jest.fn().mockResolvedValue({ amazonTaxRate: 0 }) } as never,
    { isEnabled: jest.fn().mockResolvedValue(false), rewriteTitle: jest.fn(), rewriteDescription: jest.fn() } as never,
  );

  it('refuses a live create priced from 0', async () => {
    await expect(service.prepareListingData('u', product(0), 'group-1', null, { live: true })).rejects.toBeInstanceOf(
      SourcePriceUnavailableError,
    );
  });

  it('refuses a live create when the price is missing entirely', async () => {
    const missing = { ...product(10), price: { current: Number.NaN, currency: 'USD' } } as ProductData;
    await expect(service.prepareListingData('u', missing, 'group-1', null, { live: true })).rejects.toBeInstanceOf(
      SourcePriceUnavailableError,
    );
  });

  it('allows a draft (no live flag) with a 0 price', async () => {
    const result = await service.prepareListingData('u', product(0), 'group-1', null, { applyContentAi: true });
    expect(result.title).toBe('Headphones');
  });

  it('allows a live create with a real price', async () => {
    const result = await service.prepareListingData('u', product(10), 'group-1', null, { live: true });
    expect(result.price).toBeGreaterThan(10);
  });

  it('the cheap price/quantity path never refuses, so the create worker can report zero stock first', async () => {
    const outOfStock = { ...product(0), stock: 0 } as ProductData;
    await expect(service.computePricing('u', outOfStock, 'group-1', group)).resolves.toMatchObject({ quantity: 0 });
  });

  it('classifies as a terminal, seller-readable failure', () => {
    const classified = classifyListingFailure(new SourcePriceUnavailableError('B0C1HJV7BJ'));
    expect(classified.code).toBe(ListingFailureCode.SOURCE_PRICE_UNAVAILABLE);
    expect(classified.details.retryable).toBe(false);
  });
});
