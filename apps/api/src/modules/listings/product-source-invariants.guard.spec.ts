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

  it('a live create checks zero stock BEFORE the price refusal, so an out-of-stock page reads as out of stock', () => {
    const batchStart = src.indexOf('private async processListingBatch(');
    expect(batchStart).toBeGreaterThan(-1);
    const batch = src.slice(batchStart);
    const zeroStock = batch.indexOf('throw new ZeroStockError(');
    const prepare = batch.indexOf('this.listingStrategyService.prepareListingData(');
    expect(zeroStock).toBeGreaterThan(-1);
    expect(prepare).toBeGreaterThan(zeroStock);
    // ...and the price refusal is still requested for every live create.
    expect(batch.slice(prepare, prepare + 400)).toMatch(/live: !asDraft/);
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
