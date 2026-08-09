import {
  chunkForBulk,
  correlateBulkResponses,
  describeBulkErrors,
  EBAY_BULK_MAX_BATCH,
  extractExistingOfferId,
  extractMissingAspectName,
  extractRejectedAspect,
  isBulkEntrySuccess,
  isBulkSystemError,
  type EbayBulkResponseEntry,
} from './ebay-bulk.helpers';

describe('chunkForBulk', () => {
  it('splits into batches of eBay max size by default', () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    expect(chunkForBulk(items).map((batch) => batch.length)).toEqual([25, 25, 10]);
  });

  it('returns nothing for an empty list', () => {
    expect(chunkForBulk([])).toEqual([]);
  });

  it('never exceeds eBay max even when asked for more', () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    expect(chunkForBulk(items, 100).every((batch) => batch.length <= EBAY_BULK_MAX_BATCH)).toBe(true);
  });

  it('clamps a non-positive size to a usable batch', () => {
    expect(chunkForBulk([1, 2, 3], 0).length).toBeGreaterThan(0);
  });
});

describe('isBulkEntrySuccess', () => {
  it('accepts a 200 with no errors', () => {
    expect(isBulkEntrySuccess({ statusCode: 200 })).toBe(true);
  });

  it('accepts an entry that omits statusCode', () => {
    expect(isBulkEntrySuccess({ sku: 'A-NEW' })).toBe(true);
  });

  it('rejects a 4xx', () => {
    expect(isBulkEntrySuccess({ statusCode: 400 })).toBe(false);
  });

  it('rejects a 2xx that still carries errors', () => {
    expect(isBulkEntrySuccess({ statusCode: 200, errors: [{ errorId: 25002 }] })).toBe(false);
  });

  it('rejects a missing entry', () => {
    expect(isBulkEntrySuccess(null)).toBe(false);
  });
});

describe('correlateBulkResponses', () => {
  const items = [{ sku: 'A-NEW' }, { sku: 'B-NEW' }, { sku: 'C-NEW' }];
  const skuOf = (item: { sku: string }) => item.sku;

  it('pairs by SKU regardless of response order', () => {
    const responses: EbayBulkResponseEntry[] = [
      { sku: 'C-NEW', statusCode: 200, listingId: '3' },
      { sku: 'A-NEW', statusCode: 200, listingId: '1' },
      { sku: 'B-NEW', statusCode: 400, errors: [{ message: 'nope' }] },
    ];
    const result = correlateBulkResponses(items, responses, skuOf);

    expect(result.map((outcome) => outcome.entry?.listingId)).toEqual(['1', undefined, '3']);
    expect(result.map((outcome) => outcome.ok)).toEqual([true, false, true]);
  });

  it('falls back to positional order when entries omit the SKU', () => {
    const responses: EbayBulkResponseEntry[] = [{ statusCode: 200 }, { statusCode: 500 }, { statusCode: 200 }];
    expect(correlateBulkResponses(items, responses, skuOf).map((o) => o.ok)).toEqual([true, false, true]);
  });

  it('marks an item with no response entry as failed, never as success', () => {
    // A missing answer is not evidence the write landed — recording it as
    // success is how an ACTIVE listing row gets written for something that
    // does not exist on eBay.
    const result = correlateBulkResponses(items, [{ sku: 'A-NEW', statusCode: 200 }], skuOf);
    expect(result[2].ok).toBe(false);
    expect(result[2].entry).toBeNull();
  });

  it('treats a completely absent responses array as an all-fail', () => {
    expect(correlateBulkResponses(items, undefined, skuOf).every((o) => o.ok === false)).toBe(true);
  });
});

describe('correlateBulkResponses with a custom entry key', () => {
  it('pairs publish responses by offerId, which carry no sku', () => {
    const items = [{ offerId: 'o1' }, { offerId: 'o2' }];
    const responses: EbayBulkResponseEntry[] = [
      { offerId: 'o2', statusCode: 200, listingId: '222' },
      { offerId: 'o1', statusCode: 200, listingId: '111' },
    ];

    const result = correlateBulkResponses(
      items,
      responses,
      (item) => item.offerId,
      (entry) => entry.offerId
    );

    expect(result.map((outcome) => outcome.entry?.listingId)).toEqual(['111', '222']);
  });
});

describe('extractExistingOfferId', () => {
  it('recovers the offer id eBay reports as already existing', () => {
    // Every self-heal replay collides with the offer its first pass created;
    // without this the retry can never reach publish.
    expect(
      extractExistingOfferId([
        {
          errorId: 25002,
          message: 'Offer entity already exists.',
          parameters: [{ name: 'offerId', value: '9988776655' }],
        },
      ])
    ).toBe('9988776655');
  });

  it('returns null for an unrelated 25002', () => {
    expect(extractExistingOfferId([{ errorId: 25002, message: 'System error.' }])).toBeNull();
  });

  it('returns null when there are no errors', () => {
    expect(extractExistingOfferId(undefined)).toBeNull();
  });
});

describe('extractMissingAspectName', () => {
  it('prefers parameter "2"', () => {
    expect(
      extractMissingAspectName([
        {
          errorId: 25002,
          message: 'The item specific Department is missing.',
          parameters: [{ name: '2', value: 'Department' }],
        },
      ])
    ).toBe('Department');
  });

  it('falls back to parsing the message', () => {
    expect(
      extractMissingAspectName([{ errorId: 25002, message: 'The item specific Screen Size is missing.' }])
    ).toBe('Screen Size');
  });

  it('ignores unrelated 25002 errors', () => {
    expect(extractMissingAspectName([{ errorId: 25002, message: 'System error.' }])).toBeNull();
  });

  it('returns null when there are no errors', () => {
    expect(extractMissingAspectName(undefined)).toBeNull();
  });
});

describe('extractRejectedAspect', () => {
  it('pulls the aspect name and the value eBay refused', () => {
    expect(extractRejectedAspect([{ message: 'MPN has an invalid value of "021500000529"' }])).toEqual({
      name: 'MPN',
      value: '021500000529',
    });
  });

  it('returns null for other failures', () => {
    expect(extractRejectedAspect([{ message: 'The item specific Color is missing.' }])).toBeNull();
  });
});

describe('isBulkSystemError', () => {
  it('detects eBay transient publish failure', () => {
    expect(isBulkSystemError([{ errorId: 25002, message: 'System error.' }])).toBe(true);
  });

  it('does not confuse a missing aspect with a system error', () => {
    expect(isBulkSystemError([{ errorId: 25002, message: 'The item specific Color is missing.' }])).toBe(false);
  });
});

describe('describeBulkErrors', () => {
  it('joins provider messages, preferring the long form', () => {
    expect(
      describeBulkErrors({ errors: [{ message: 'short', longMessage: 'the long one' }, { message: 'second' }] })
    ).toBe('the long one; second');
  });

  it('explains a missing entry rather than returning an empty string', () => {
    expect(describeBulkErrors(null)).toContain('no result');
  });

  it('falls back to the status code when eBay sends no error body', () => {
    expect(describeBulkErrors({ statusCode: 500 })).toContain('500');
  });
});
