import * as fs from 'fs';
import * as path from 'path';

/**
 * Nest resolves module imports eagerly, so a cycle does not fail a unit test —
 * it fails the whole application at boot with "The module at index [N] is
 * undefined", which is only discovered by running the API.
 *
 * The cycle that actually happened:
 *   EbayModule -> LlmModule (item-specific selection)
 *   LlmModule  -> AdminModule (usage projection + pricing)
 *   AdminModule -> EbayModule (admin listing-quality wanted taxonomy metadata)
 *
 * AdminModule sits at the bottom of that chain, so it must not import feature
 * modules that already depend on the LLM. Admin reads the data those modules
 * persisted (here: the `ebay_category_aspects` snapshot table) instead.
 */
const ADMIN_DIR = __dirname;

function read(file: string): string {
  return fs.readFileSync(path.join(ADMIN_DIR, file), 'utf8');
}

describe('AdminModule dependency direction', () => {
  it('does not import EbayModule (would close the Ebay -> Llm -> Admin cycle)', () => {
    const source = read('admin.module.ts');

    expect(source).not.toMatch(/from '\.\.\/ebay\/ebay\.module'/);
    expect(source).not.toMatch(/\bEbayModule\b/);
  });

  it('keeps the admin listing-quality service off eBay services', () => {
    const source = read('admin-listing-quality.service.ts');

    // The explanatory comment may name the service; an import must not exist.
    expect(source).not.toMatch(/^import .*EbayTaxonomyService.*$/m);
    expect(source).not.toMatch(/from '\.\.\/ebay\//);
  });

  it('does not import ListingsModule (ListingsModule already imports AdminModule)', () => {
    // Task 7 (scraper client / product-source switch): ScraperClient and
    // ProductSourceService were deliberately NOT added as ListingsModule
    // providers/exports for this exact reason. ListingsModule -> AdminModule
    // already exists (listings.module.ts), so AdminModule -> ListingsModule
    // would close a direct cycle. Both providers instead live in their own
    // `ProductSourceModule` (apps/api/src/modules/listings/product-source.module.ts),
    // which has no feature-module imports, so AdminModule (Task 12's scraper
    // observability tab) and ListingsModule can each import it directly.
    const source = read('admin.module.ts');

    expect(source).not.toMatch(/from '\.\.\/listings\/listings\.module'/);
    expect(source).not.toMatch(/\bListingsModule\b/);
  });
});
