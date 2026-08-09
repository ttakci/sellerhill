import { ListingFailureCode } from '@repo/shared';

import { CategoryResolutionError, ListingPublishExhaustedError } from '../ebay/ebay.errors';

import {
  classifyListingFailure,
  extractMissingAspectName,
  extractRejectedAspect,
  formatEbayErrors,
} from './listing-failure';

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
});

describe('extractRejectedAspect', () => {
  it('reads the aspect and the refused value', () => {
    expect(
      extractRejectedAspect({ message: 'MPN has an invalid value of "021500000529". Enter a valid value.' })
    ).toEqual({ aspectName: 'MPN', value: '021500000529' });
  });
});

describe('classifyListingFailure', () => {
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

describe('formatEbayErrors', () => {
  it('keeps the raw provider text readable for the technical-details panel', () => {
    expect(
      formatEbayErrors([{ message: 'Bad thing', parameters: [{ name: 'aspect', value: 'Department' }] }])
    ).toBe('Bad thing (aspect: Department)');
  });
});
