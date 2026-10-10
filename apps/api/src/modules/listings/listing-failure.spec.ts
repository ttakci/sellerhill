import { ListingFailureCode } from '@repo/shared';

import { CategoryResolutionError, ListingPublishExhaustedError } from '../ebay/ebay.errors';

import {
  classifyListingFailure,
  extractMissingAspectName,
  extractRejectedAspect,
  formatEbayErrors,
} from './listing-failure';
import { AsinNotFoundError } from './listing-processor.service';

const ebayError = (errors: Array<Record<string, unknown>>, status = 400): unknown => ({
  message: 'Request failed',
  response: { status, data: { errors } },
});

describe('extractMissingAspectName', () => {
  it('reads the aspect from eBay parameter "2"', () => {
    expect(
      extractMissingAspectName({
        errorId: 25002,
        message: 'The item specific Department is missing.',
        parameters: [{ name: '2', value: 'Department' }],
      })
    ).toBe('Department');
  });

  it('falls back to parsing the message', () => {
    expect(extractMissingAspectName({ message: 'The item specific Size Type is missing.' })).toBe('Size Type');
  });

  it('never reads a positional parameter from an unrelated error', () => {
    // eBay's parameters are positional per MESSAGE TEMPLATE — parameter "2" is
    // only the aspect name on the missing-item-specific error. On any other
    // error it is whatever that template's second placeholder happens to be
    // (a quantity, a field name, a category id). Reading it unguarded is how a
    // seller was shown 'eBay requires the item specific "1"' for a failure
    // that had nothing to do with item specifics.
    expect(
      extractMissingAspectName({
        errorId: 25016,
        message: 'Invalid value for availableQuantity.',
        parameters: [
          { name: '1', value: 'availableQuantity' },
          { name: '2', value: '1' },
        ],
      })
    ).toBeNull();
  });
});

describe('extractRejectedAspect', () => {
  it('reads the aspect and the refused value', () => {
    expect(
      extractRejectedAspect({ message: 'MPN has an invalid value of "021500000529". Enter a valid value.' })
    ).toEqual({ aspectName: 'MPN', value: '021500000529' });
  });
});

describe('classifyListingFailure', () => {
  it("reads eBay's Picture Policy refusal as an image problem, never a missing business policy", () => {
    // The live message; "Policy" in "Picture Policy" used to route it to
    // EBAY_POLICY_MISSING, telling the seller their business policies were
    // broken when the same policies had just published 17 other listings.
    const failure = classifyListingFailure(
      ebayError([
        {
          errorId: 25002,
          message:
            "A user error has occurred. The resolution for provided picture(s) does not meet eBay's Picture Policy requirements. Please only use pictures that are at least 500 pixels on the longest side.",
        },
      ])
    );
    expect(failure.code).toBe(ListingFailureCode.IMAGE_INVALID);
  });

  it('reports a missing product identifier generically — it is our payload gap, not the seller’s product', () => {
    // The real shape eBay sent in production (errorId 25002, parameters
    // positional: "2" is "1", "3" is "UPC"). Before: read as a missing aspect
    // named "1", and once that was guarded, as an eBay duplicate item by id.
    const failure = classifyListingFailure(
      ebayError([
        {
          errorId: 25002,
          message: 'A user error has occurred. The UPC field is missing. Please add UPC to the listing and try again.',
          parameters: [
            { name: '0', value: 'The UPC field is missing.' },
            { name: '1', value: 'The UPC field is missing. Please add UPC to the listing and try again.' },
            { name: '2', value: '1' },
            { name: '3', value: 'UPC' },
          ],
        },
      ])
    );
    expect(failure.code).toBe(ListingFailureCode.UNKNOWN);
    expect(failure.details.retryable).toBe(false);
    expect(failure.details.aspectNames).toBeUndefined();
  });

  it('claims an eBay duplicate item only when the message says so — 25002 is a generic user-error id', () => {
    const failure = classifyListingFailure(
      ebayError([{ errorId: 25002, message: 'A user error has occurred. The listing duration is invalid.' }])
    );
    expect(failure.code).not.toBe(ListingFailureCode.EBAY_DUPLICATE_ITEM);
  });

  it('does not classify an unrelated parameterised error as a missing aspect', () => {
    const failure = classifyListingFailure(
      ebayError([
        {
          errorId: 25016,
          message: 'Invalid value for availableQuantity.',
          parameters: [
            { name: '1', value: 'availableQuantity' },
            { name: '2', value: '1' },
          ],
        },
      ])
    );
    expect(failure.code).not.toBe(ListingFailureCode.ASPECT_MISSING);
  });

  it('classifies a missing item specific with the aspect name', () => {
    const failure = classifyListingFailure(
      ebayError([
        { errorId: 25002, message: 'The item specific Department is missing.', parameters: [{ name: '2', value: 'Department' }] },
      ])
    );

    expect(failure.code).toBe(ListingFailureCode.ASPECT_MISSING);
    expect(failure.details.aspectNames).toEqual(['Department']);
    expect(failure.details.retryable).toBe(false);
  });

  it('separates a rejected identifier from a rejected aspect', () => {
    // The live failure: Amazon puts the UPC in partNumber, eBay refuses it.
    expect(
      classifyListingFailure(ebayError([{ message: 'MPN has an invalid value of "021500000529".' }])).code
    ).toBe(ListingFailureCode.INVALID_IDENTIFIER);

    expect(classifyListingFailure(ebayError([{ message: 'Color has an invalid value of "Chartreuse".' }])).code).toBe(
      ListingFailureCode.ASPECT_REJECTED
    );
  });

  it('reads eBay 25001 as an eBay-side outage, not an unknown failure', () => {
    // Observed live 2026-07-31: three job items failed with only errorId 25001
    // and a message naming an internal eBay service. The request was fine.
    const failure = classifyListingFailure(
      ebayError([{ errorId: 25001, message: 'A system error has occurred. Core Inventory Service internal error' }])
    );

    expect(failure.code).toBe(ListingFailureCode.EBAY_UNAVAILABLE);
    expect(failure.details.retryable).toBe(true);
    expect(failure.details.ebayErrorIds).toEqual([25001]);
  });

  it('lets a specific cause win when eBay also reports its system error', () => {
    const failure = classifyListingFailure(
      ebayError([
        { errorId: 25001, message: 'A system error has occurred.' },
        { errorId: 25002, message: 'The item specific Department is missing.', parameters: [{ name: '2', value: 'Department' }] },
      ])
    );

    expect(failure.code).toBe(ListingFailureCode.ASPECT_MISSING);
  });

  it('maps our typed create-path errors', () => {
    expect(classifyListingFailure(new CategoryResolutionError('Badia Seasoning')).code).toBe(
      ListingFailureCode.CATEGORY_UNRESOLVED
    );
    expect(classifyListingFailure(new ListingPublishExhaustedError('260988', ['Department'], 3)).code).toBe(
      ListingFailureCode.EBAY_UNAVAILABLE
    );
  });

  it('maps a definitive ASIN miss to ASIN_NOT_FOUND, terminal — never the retryable PRODUCT_DATA_UNAVAILABLE bucket', () => {
    // A malformed identifier (wrong shape) and a well-formed one Keepa has no
    // data for both throw the same typed error — see resolveProductData.
    const failure = classifyListingFailure(new AsinNotFoundError('NOTAREALASIN'));

    expect(failure.code).toBe(ListingFailureCode.ASIN_NOT_FOUND);
    expect(failure.details.retryable).toBe(false);
  });

  it('maps a seller-configured blacklist rejection with its keyword', () => {
    const failure = classifyListingFailure(new Error('Description contains blacklisted keyword: 3M'));

    expect(failure.code).toBe(ListingFailureCode.BLACKLISTED_KEYWORD);
    expect(failure.details.blacklistedKeyword).toBe('3M');
    expect(failure.details.retryable).toBe(false);
  });

  it('maps the worker\'s own guard messages', () => {
    expect(classifyListingFailure(new Error('DUPLICATE_LISTING: already listed')).code).toBe(
      ListingFailureCode.DUPLICATE_LISTING
    );
    expect(classifyListingFailure(new Error('Cannot list ASIN B0: Stock is 0. …')).code).toBe(
      ListingFailureCode.ZERO_STOCK
    );
    expect(classifyListingFailure(new Error('Keepa returned no product for ASIN B0')).code).toBe(
      ListingFailureCode.PRODUCT_DATA_UNAVAILABLE
    );
    expect(classifyListingFailure(new Error('No active eBay account found for user')).code).toBe(
      ListingFailureCode.EBAY_AUTH
    );
  });

  it('maps transport status codes', () => {
    expect(classifyListingFailure({ message: 'x', response: { status: 401, data: {} } }).code).toBe(
      ListingFailureCode.EBAY_AUTH
    );
    expect(classifyListingFailure({ message: 'x', response: { status: 429, data: {} } }).code).toBe(
      ListingFailureCode.EBAY_RATE_LIMITED
    );
    expect(classifyListingFailure({ message: 'x', response: { status: 503, data: {} } }).code).toBe(
      ListingFailureCode.EBAY_UNAVAILABLE
    );
  });

  it('extracts errors nested under a bulk envelope\'s responses[] (whole-batch failure shape)', () => {
    // Observed live 2026-08-10: bulk_publish_offer rejected the whole batch
    // with HTTP 400; eBay's error is nested per response entry, not on a
    // top-level `errors` array, so the extractor must look in both places.
    const failure = classifyListingFailure({
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: {
          responses: [
            {
              statusCode: 400,
              offerId: '11432468010',
              errors: [
                {
                  errorId: 25002,
                  message: 'It looks like this listing is for an item you already have on eBay: Widget (110590178528).',
                },
              ],
            },
          ],
        },
      },
    });

    expect(failure.code).toBe(ListingFailureCode.EBAY_DUPLICATE_ITEM);
    expect(failure.details.retryable).toBe(false);
    expect(failure.details.ebayErrorIds).toEqual([25002]);
  });

  it('does not call an "Offer entity already exists" 25002 a duplicate item', () => {
    // That reply means our own stale offer collided with the SKU, not that a
    // live identical listing exists — telling the seller to end a listing they
    // already ended sent them in circles.
    const failure = classifyListingFailure(
      ebayError([
        { errorId: 25002, message: 'A user error has occurred. Offer entity already exists. (offerId: 281563979011)' },
      ])
    );

    expect(failure.code).not.toBe(ListingFailureCode.EBAY_DUPLICATE_ITEM);
  });

  it('classifies policy and image rejections', () => {
    expect(classifyListingFailure(ebayError([{ message: 'The fulfillment policy is not valid.' }])).code).toBe(
      ListingFailureCode.EBAY_POLICY_MISSING
    );
    expect(classifyListingFailure(ebayError([{ message: 'The image URL could not be processed.' }])).code).toBe(
      ListingFailureCode.IMAGE_INVALID
    );
  });

  it('never throws on an unrecognised failure', () => {
    const failure = classifyListingFailure('something odd happened');
    expect(failure.code).toBe(ListingFailureCode.UNKNOWN);
    expect(failure.message).toBe('something odd happened');
  });
});

describe('scraper provider failures', () => {
  it('ProductDataUnavailableError is retryable PRODUCT_DATA_UNAVAILABLE, never ASIN_NOT_FOUND', () => {
    const e = Object.assign(new Error('scraper: blocked for B000000001'), { name: 'ProductDataUnavailableError' });
    expect(classifyListingFailure(e)).toMatchObject({ code: ListingFailureCode.PRODUCT_DATA_UNAVAILABLE, details: { retryable: true } });
  });
  it('NoBuyBoxError is its own terminal reason — a retry cannot create a Buy Box', () => {
    const e = Object.assign(new Error('no Buy Box for B000000001'), { name: 'NoBuyBoxError' });
    expect(classifyListingFailure(e)).toMatchObject({ code: ListingFailureCode.NO_BUY_BOX, details: { retryable: false } });
  });
  it('ScraperUnavailableError is retryable PRODUCT_DATA_UNAVAILABLE', () => {
    const e = Object.assign(new Error('scraper request failed: network'), { name: 'ScraperUnavailableError' });
    expect(classifyListingFailure(e)).toMatchObject({ code: ListingFailureCode.PRODUCT_DATA_UNAVAILABLE, details: { retryable: true } });
  });
  it('ZeroStockError carries the stock numbers for the seller message', () => {
    const e = Object.assign(new Error('Cannot list ASIN B000000001: Stock is 0.'), {
      name: 'ZeroStockError', amazonStock: 4, amazonStockAtLeast: true, stockBuffer: 5,
    });
    expect(classifyListingFailure(e)).toMatchObject({
      code: ListingFailureCode.ZERO_STOCK,
      details: { retryable: true, amazonStock: 4, amazonStockAtLeast: true, stockBuffer: 5 },
    });
  });
});

describe('formatEbayErrors', () => {
  it('keeps the raw provider text readable for the technical-details panel', () => {
    expect(
      formatEbayErrors([{ message: 'Bad thing', parameters: [{ name: 'aspect', value: 'Department' }] }])
    ).toBe('Bad thing (aspect: Department)');
  });
});

describe('eBay refusals a seller must be able to read (competitor parity, 2026-10-10)', () => {
  it('reads a links-policy refusal as a description link, never as a missing business policy', () => {
    const failure = classifyListingFailure(
      ebayError([
        {
          errorId: 21916860,
          message:
            "We've noticed that your listing included a shortened URL. eBay no longer permits shortened URLs (e.g. bitly or tinyurl) in item descriptions, payment instructions, return instructions, etc, regardless of where they link to. To learn what else is no longer permitted in our updated Links policy, please see: http://pages.ebay.com/sellerinformation/news/links2011.html",
        },
      ])
    );
    expect(failure.code).toBe(ListingFailureCode.EBAY_DESCRIPTION_LINK);
    expect(failure.details.retryable).toBe(false);
  });

  it('still reads a real business-policy refusal as one', () => {
    expect(classifyListingFailure(ebayError([{ message: 'The fulfillmentPolicyId is invalid.' }])).code).toBe(
      ListingFailureCode.EBAY_POLICY_MISSING
    );
    expect(classifyListingFailure(ebayError([{ message: 'Return policy is required.' }])).code).toBe(
      ListingFailureCode.EBAY_POLICY_MISSING
    );
  });

  it('reads a category mismatch and keeps the category eBay names', () => {
    const failure = classifyListingFailure(
      ebayError([
        {
          message:
            'From your title, you appear to be selling a GPS accessories. Accessories for GPS, including bundles that only include accessories, should be listed under the Electronics > GPS Navigation> Accessories category. If you are selling a GPS with accessories, please include the word "bundle" in your title.',
        },
      ])
    );
    expect(failure.code).toBe(ListingFailureCode.EBAY_CATEGORY_MISMATCH);
    expect(failure.details.categoryName).toBe('Electronics > GPS Navigation > Accessories');
  });

  it('reads an invalid condition for the category', () => {
    expect(
      classifyListingFailure(ebayError([{ message: 'The provided condition id is invalid for the selected primary category id.' }])).code
    ).toBe(ListingFailureCode.EBAY_CONDITION_INVALID);
  });

  it('reads "X is a required field" as a missing item specific, not as the item condition', () => {
    const failure = classifyListingFailure(ebayError([{ message: 'Coin Condition (2) is a required field.' }]));
    expect(failure.code).toBe(ListingFailureCode.ASPECT_MISSING);
    expect(failure.details.aspectNames).toEqual(['Coin Condition']);
  });

  it('keeps the value eBay refused, in both of its wordings', () => {
    const trading = classifyListingFailure(
      ebayError([{ message: '"10.5" is not a valid value for EU Shoe Size. Select a value from the available options.' }])
    );
    expect(trading.code).toBe(ListingFailureCode.ASPECT_REJECTED);
    expect(trading.details).toMatchObject({ aspectNames: ['EU Shoe Size'], rejectedValue: '10.5' });

    const inventory = classifyListingFailure(ebayError([{ message: 'Color has an invalid value of "Blu".' }]));
    expect(inventory.details).toMatchObject({ aspectNames: ['Color'], rejectedValue: 'Blu' });
  });

  it('carries the ASIN Amazon opened instead of the requested one', () => {
    const error = Object.assign(new Error('B0OLD00001 opened B0NEW00001'), {
      name: 'AsinRedirectedError',
      resolvedAsin: 'B0NEW00001',
    });
    const failure = classifyListingFailure(error);
    expect(failure.code).toBe(ListingFailureCode.ASIN_REDIRECTED);
    expect(failure.details).toMatchObject({ resolvedAsin: 'B0NEW00001', retryable: false });
  });
});
