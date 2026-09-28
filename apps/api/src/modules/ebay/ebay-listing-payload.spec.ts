import { EbayMarketplaceId, type ListingCreationData } from '@repo/shared';

import type { AspectResolution } from './aspect-builder';
import { buildInventoryItemPayload, resolveCatalogIdentifiers } from './ebay-listing-payload';

const data = (overrides: Partial<ListingCreationData> = {}): ListingCreationData =>
  ({
    title: 'Widget',
    description: '<p>desc</p>',
    brand: 'Acme',
    imageUrls: ['https://i.ebayimg.com/a.jpg'],
    quantity: 1,
    ...overrides,
  }) as unknown as ListingCreationData;

const resolution = { aspects: {} } as unknown as AspectResolution;

describe('resolveCatalogIdentifiers', () => {
  it('sends a valid UPC as-is', () => {
    expect(resolveCatalogIdentifiers(data({ identifiers: { upc: '036000291452' } })).upc).toBe('036000291452');
  });

  it("sends eBay's documented substitute when the product has no UPC", () => {
    // eBay's Inventory guidance ("Product Identifier Text"): when the category
    // requires a GTIN and the product has none, send the site's substitute
    // text. Omitting the field is what made eBay refuse the publish with
    // "The UPC field is missing" — the seller was never shown the product, and
    // the substitute is exactly how every other listing tool lists it.
    expect(resolveCatalogIdentifiers(data()).upc).toBe('Does not apply');
  });

  it('uses the marketplace-specific substitute text', () => {
    expect(resolveCatalogIdentifiers(data(), EbayMarketplaceId.EBAY_DE).upc).toBe('Nicht zutreffend');
  });

  it('never substitutes an EAN — only the field eBay requires on the site', () => {
    expect(resolveCatalogIdentifiers(data()).ean).toBeUndefined();
  });
});

describe('buildInventoryItemPayload', () => {
  it('carries the UPC substitute into product.upc', () => {
    const { payload } = buildInventoryItemPayload(data(), resolution);
    expect(payload.product.upc).toEqual(['Does not apply']);
  });

  it('carries a real UPC into product.upc unchanged', () => {
    const { payload } = buildInventoryItemPayload(data({ identifiers: { upc: '036000291452' } }), resolution);
    expect(payload.product.upc).toEqual(['036000291452']);
  });
});
