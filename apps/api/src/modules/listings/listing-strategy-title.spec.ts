import { TemplateType, type ListingSettingsGroup, type ProductData } from '@repo/shared';

import { ListingStrategyService } from './listing-strategy.service';

/**
 * The description must advertise the title the LISTING actually carries.
 *
 * `{{title}}` was rendered from `product.title` — the raw Amazon one — while
 * eBay received a brand-stripped, truncated, optionally AI-rewritten title. So
 * a seller who turned on brand stripping (or AI titles) got a listing whose own
 * description contradicted its title, with the supplier's brand still visible
 * in the body. The rewrite also ran AFTER the template had been rendered, so an
 * AI title could never have reached it whatever the context was built from.
 */
interface RewriteInput {
  baseTitle: string;
  baseDescription: string;
}

describe('ListingStrategyService — the description renders the listing title', () => {
  const product: ProductData = {
    asin: 'B0C1HJV7BJ',
    title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
    brand: 'Sony',
    description: 'Great headphones.',
    features: [],
    specs: {},
    identifiers: {},
    imageUrls: ['https://example.com/a.jpg'],
    price: { current: 20, currency: 'USD' },
    stock: 10,
  } as unknown as ProductData;

  const buildGroup = (content: Record<string, boolean>): ListingSettingsGroup =>
    ({
      id: 'group-1',
      templates: { type: TemplateType.CUSTOM, customTemplateHtml: '<p class="t">{{title}}</p>' },
      content,
      stock: { defaultQuantity: 5, stockBuffer: 0 },
      repricingStrategy: [{ id: 'r1', minPrice: 0, maxPrice: 9999, profitMarginPercent: 20 }],
      fees: { ebayFeePercent: 13, fixedFeeAmount: 0.3 },
    }) as unknown as ListingSettingsGroup;

  const buildService = (
    group: ListingSettingsGroup,
    contentGeneration: Partial<{
      isEnabled: () => Promise<boolean>;
      rewriteTitle: (input: RewriteInput) => Promise<string>;
      rewriteDescription: (input: RewriteInput) => Promise<string>;
    }> = {},
  ): ListingStrategyService =>
    new ListingStrategyService(
      { getListingSettingsGroupById: jest.fn().mockResolvedValue(group) } as never,
      { getResolvedSettings: jest.fn().mockResolvedValue({ amazonTaxRate: 0 }) } as never,
      {
        isEnabled: jest.fn().mockResolvedValue(false),
        rewriteTitle: jest.fn(),
        rewriteDescription: jest.fn(),
        ...contentGeneration,
      } as never,
    );

  it('strips the brand from the title inside the description, not just from the listing title', async () => {
    const group = buildGroup({ stripBrandFromTitle: true });
    const result = await buildService(group).prepareListingData('user-1', product, 'group-1');

    expect(result.title).not.toContain('Sony');
    expect(result.description).toContain(result.title);
    // The whole point: the supplier's brand is gone from the body too.
    expect(result.description).not.toContain('Sony');
  });

  it('renders the AI-rewritten title, which the old ordering could never reach', async () => {
    const group = buildGroup({ aiTitleEnabled: true });
    const service = buildService(group, {
      isEnabled: jest.fn().mockResolvedValue(true),
      rewriteTitle: jest.fn().mockResolvedValue('Premium Wireless ANC Headphones XM5 Black'),
    });

    const result = await service.prepareListingData('user-1', product, 'group-1', null, {
      applyContentAi: true,
    });

    expect(result.title).toBe('Premium Wireless ANC Headphones XM5 Black');
    expect(result.description).toContain('Premium Wireless ANC Headphones XM5 Black');
    expect(result.description).not.toContain('Sony WH-1000XM5 Wireless Noise Canceling');
  });

  it('still renders the deterministic title when no content rules are set', async () => {
    const group = buildGroup({});
    const result = await buildService(group).prepareListingData('user-1', product, 'group-1');

    expect(result.title).toBe(product.title);
    expect(result.description).toContain(product.title);
  });

  it('feeds the AI description the final title, not the raw one', async () => {
    const rewriteDescription = jest
      .fn<Promise<string>, [RewriteInput]>()
      .mockResolvedValue('<p>body</p>');
    const group = buildGroup({ aiTitleEnabled: true, aiDescriptionEnabled: true });
    const service = buildService(group, {
      isEnabled: jest.fn().mockResolvedValue(true),
      rewriteTitle: jest.fn().mockResolvedValue('Rewritten Title'),
      rewriteDescription,
    });

    await service.prepareListingData('user-1', product, 'group-1', null, { applyContentAi: true });

    expect(rewriteDescription).toHaveBeenCalledWith(
      expect.objectContaining({ baseTitle: 'Rewritten Title' }),
    );
    // And the template it was handed had already rendered that same title.
    expect(rewriteDescription.mock.calls[0][0].baseDescription).toContain('Rewritten Title');
  });
});
