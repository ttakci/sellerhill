import {
  ListingFailureCode,
  ListingStatus,
  TemplateType,
  type ListingSettingsGroup,
  type ProductData,
} from '@repo/shared';

import { classifyListingFailure } from './listing-failure';
import { ListingStrategyService, SourcePriceUnavailableError } from './listing-strategy.service';
import { ListingsService } from './listings.service';

/**
 * The safety net for a draft saved from an out-of-stock page with no price
 * (stored at price 0): publishing it is refused exactly like a live create
 * priced from 0. `prepareDraftForPublish` calls the shared
 * `assertSourcePricePublishable` before the EPS upload (and
 * `prepareListingData({ live: true })` re-checks), so this goes through
 * `publishListing` with a REAL strategy service rather than asserting on a mock.
 */
describe('draft publish — non-positive source price', () => {
  const group = {
    id: 'group-1',
    templates: { type: TemplateType.CUSTOM, customTemplateHtml: '<p class="t">{{title}}</p>' },
    content: {},
    stock: { defaultQuantity: 5, stockBuffer: 0 },
    repricingStrategy: [{ id: 'r1', minPrice: 0, maxPrice: 9999, profitMarginPercent: 20 }],
    fees: { ebayFeePercent: 13, fixedFeeAmount: 0.3 },
  } as unknown as ListingSettingsGroup;

  const product = (current: number): ProductData =>
    ({
      asin: 'B0C1HJV7BJ',
      title: 'Headphones',
      brand: 'Brand',
      description: 'd',
      features: [],
      specs: {},
      identifiers: {},
      imageUrls: ['https://m.media-amazon.com/images/I/x.jpg'],
      price: { current, currency: 'USD' },
      stock: 0,
    }) as unknown as ProductData;

  function build(current: number) {
    const strategy = new ListingStrategyService(
      { getListingSettingsGroupById: jest.fn().mockResolvedValue(group) } as never,
      { getResolvedSettings: jest.fn().mockResolvedValue({ amazonTaxRate: 0 }) } as never,
      { isEnabled: jest.fn().mockResolvedValue(false), rewriteTitle: jest.fn(), rewriteDescription: jest.fn() } as never,
    );
    const prepareSpy = jest.spyOn(strategy, 'prepareListingData');
    const ebayImages = { resolve: jest.fn() };
    const service = new ListingsService(
      { query: jest.fn().mockResolvedValue([]) } as never,
      { resolveListingAccountId: jest.fn().mockResolvedValue('account-1') } as never,
      {} as never,
      strategy,
      {} as never,
      {} as never,
      ebayImages as never,
    );
    jest.spyOn(service, 'getListing').mockResolvedValue({
      id: 'listing-1',
      asin: 'B0C1HJV7BJ',
      status: ListingStatus.DRAFT,
      listingSettingsGroupId: 'group-1',
      ebayAccountId: 'account-1',
    } as never);
    jest.spyOn(service, 'getProductByAsin').mockResolvedValue({ id: 'product-1', data: product(current) } as never);
    return { service, prepareSpy, ebayImages };
  }

  it('refuses to publish a draft priced from 0, with the same code as a live create', async () => {
    const { service, prepareSpy, ebayImages } = build(0);
    const error = await service.publishListing('user-1', 'listing-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SourcePriceUnavailableError);
    // Refused before the EPS upload and before any strategy/LLM work.
    expect(ebayImages.resolve).not.toHaveBeenCalled();
    expect(prepareSpy).not.toHaveBeenCalled();
    const classified = classifyListingFailure(error);
    expect(classified.code).toBe(ListingFailureCode.SOURCE_PRICE_UNAVAILABLE);
    expect(classified.details.retryable).toBe(false);
  });
});
