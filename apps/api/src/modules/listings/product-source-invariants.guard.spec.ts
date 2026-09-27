// apps/api/src/modules/listings/product-source-invariants.guard.spec.ts
//
// Two provider-switch invariants that fail silently if they regress:
//
// (a) No Keepa call while the scraper is the active provider (binding operator
//     decision: Keepa is a WHOLE-provider rollback, never a per-ASIN fallback).
//     A regression would spend Keepa tokens on every scraper miss with nothing
//     visible to the seller. `resolveProductData` is sliced out of the source,
//     comments stripped, and the scraper branch must return/throw on its own
//     with no reference to the Keepa client.
// (b) "The scraper could not get an answer" is never "the ASIN does not
//     exist". PRODUCT_DATA_UNAVAILABLE is retryable; ASIN_NOT_FOUND is
//     terminal — conflating them would permanently fail a real product on a
//     blocked page.

import * as fs from 'fs';
import * as path from 'path';

import { ListingFailureCode } from '@repo/shared';

import { classifyListingFailure } from './listing-failure';

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') {depth += 1;}
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {return i;}
    }
  }
  return -1;
}

describe('product source invariants', () => {
  const src = stripComments(
    fs.readFileSync(path.join(__dirname, 'listing-processor.service.ts'), 'utf8').replace(/\r\n/g, '\n'),
  );
  const start = src.indexOf('async resolveProductData(');
  const end = src.indexOf('async prepareImportedListingData(');
  const body = src.slice(start, end);

  it('resolveProductData is found', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it('the scraper branch never calls Keepa and always returns or throws before the Keepa path', () => {
    const branch = /if \(\(await this\.productSource\.activeProvider\(\)\) === ProductDataProviderKind\.SCRAPER\) \{/.exec(body);
    expect(branch).not.toBeNull();
    const open = (branch?.index ?? 0) + (branch?.[0].length ?? 0) - 1;
    const close = matchingBrace(body, open);
    expect(close).toBeGreaterThan(open);
    const scraperBranch = body.slice(open + 1, close);

    expect(scraperBranch).not.toMatch(/keepa/i);
    // The branch ends in a return, so control never falls through to Keepa.
    expect(scraperBranch.trim()).toMatch(/return \{ productData: result\.product, productId \};$/);

    const keepaCall = body.indexOf('this.keepaService.getProductDetailsWithMeta(');
    expect(keepaCall).toBeGreaterThan(close);
  });

  it('a live create: zero stock, then the price refusal, then EPS and prepareListingData — a refused item spends nothing', () => {
    const batchStart = src.indexOf('private async processListingBatch(');
    expect(batchStart).toBeGreaterThan(-1);
    const batch = src.slice(batchStart);
    const zeroStock = batch.indexOf('throw new ZeroStockError(');
    const priceRefusal = batch.indexOf('assertSourcePricePublishable(productData)');
    const eps = batch.indexOf('await attachEpsImages(');
    const prepare = batch.indexOf('this.listingStrategyService.prepareListingData(');
    expect(zeroStock).toBeGreaterThan(-1);
    expect(priceRefusal).toBeGreaterThan(zeroStock);
    expect(eps).toBeGreaterThan(priceRefusal);
    expect(prepare).toBeGreaterThan(eps);
    // ...and prepareListingData still re-checks for every live create.
    expect(batch.slice(prepare, prepare + 400)).toMatch(/live: !asDraft/);
  });

  it('draft publish refuses an unknown price BEFORE the EPS upload, and re-checks under live', () => {
    const listings = stripComments(
      fs.readFileSync(path.join(__dirname, 'listings.service.ts'), 'utf8').replace(/\r\n/g, '\n'),
    );
    const startAt = listings.indexOf('private async prepareDraftForPublish(');
    expect(startAt).toBeGreaterThan(-1);
    const publish = listings.slice(startAt, listings.indexOf('\n  }\n', startAt));
    const priceRefusal = publish.indexOf('assertSourcePricePublishable(product.data)');
    const eps = publish.indexOf('await attachEpsImages(');
    expect(priceRefusal).toBeGreaterThan(-1);
    expect(eps).toBeGreaterThan(priceRefusal);
    expect(publish).toMatch(/applyContentAi: false, live: true/);
  });

  it('a cached row with no usable price is a cache miss, so re-adding the ASIN re-fetches it', () => {
    const cacheAt = src.indexOf('private asUsableCache(');
    expect(cacheAt).toBeGreaterThan(-1);
    const cache = src.slice(cacheAt, src.indexOf('\n  }\n', cacheAt));
    expect(cache).toMatch(/Number\(existing\.data\.price\?\.current\) > 0/);
  });

  it('a single draft publish refused for an unknown price is a 409 with a localized reason, not a 500', () => {
    const controller = stripComments(
      fs.readFileSync(path.join(__dirname, 'listings.controller.ts'), 'utf8').replace(/\r\n/g, '\n'),
    );
    expect(controller).toMatch(/SourcePriceUnavailableError: 'listings\.jobs\.failure\.source_price_unavailable'/);
    const publishAt = controller.indexOf('async publishListing(');
    expect(publishAt).toBeGreaterThan(-1);
    expect(controller.slice(publishAt, publishAt + 400)).toMatch(/rethrowListingRefusal\(error\)/);
    for (const locale of ['en', 'tr']) {
      const json = JSON.parse(
        fs.readFileSync(path.join(__dirname, `../../../../../packages/shared/src/i18n/resources/${locale}/listings.json`), 'utf8'),
      ) as { listings: { jobs: { failure: Record<string, string> } } };
      expect(json.listings.jobs.failure.source_price_unavailable).toBeTruthy();
    }
  });

  it('the price/stock fan-out skips a product whose stored price is not > 0, before any listing is priced', () => {
    const sync = stripComments(
      fs.readFileSync(path.join(__dirname, 'product-sync.service.ts'), 'utf8').replace(/\r\n/g, '\n'),
    );
    const startAt = sync.indexOf('async computePendingUpdates(');
    expect(startAt).toBeGreaterThan(-1);
    const body = sync.slice(startAt, sync.indexOf('async flushUpdates(', startAt));
    const guard = /if \(!\(Number\(productInfo\.data\.price\?\.current\) > 0\)\) \{/.exec(body);
    expect(guard).not.toBeNull();
    const open = (guard?.index ?? 0) + (guard?.[0].length ?? 0) - 1;
    const close = matchingBrace(body, open);
    expect(body.slice(open, close)).toMatch(/return \[\];/);
    expect(body.indexOf('this.buildPendingUpdate(')).toBeGreaterThan(close);
  });

  it('an unanswered scraper fetch is retryable PRODUCT_DATA_UNAVAILABLE, never ASIN_NOT_FOUND', () => {
    for (const name of ['ProductDataUnavailableError', 'ScraperUnavailableError']) {
      const error = Object.assign(new Error('scraper: blocked for B000000001'), { name });
      const classified = classifyListingFailure(error);
      expect(classified.code).toBe(ListingFailureCode.PRODUCT_DATA_UNAVAILABLE);
      expect(classified.code).not.toBe(ListingFailureCode.ASIN_NOT_FOUND);
      expect(classified.details.retryable).toBe(true);
    }
    const missing = Object.assign(new Error('No product could be resolved'), { name: 'AsinNotFoundError' });
    expect(classifyListingFailure(missing).code).toBe(ListingFailureCode.ASIN_NOT_FOUND);
  });
});
