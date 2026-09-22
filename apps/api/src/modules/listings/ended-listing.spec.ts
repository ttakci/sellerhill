import { isEndedListingFailure, isEndedListingErrorId } from './ended-listing';

describe('isEndedListingFailure', () => {
  it('recognises eBay\'s "the offer/SKU is not there" ids', () => {
    for (const errorId of [25701, 25702, 25710, 25713, 25725]) {
      expect(isEndedListingErrorId(errorId)).toBe(true);
      expect(isEndedListingFailure([errorId])).toBe(true);
    }
  });

  it('never retires a listing that is alive but refused', () => {
    // Each of these describes a LIVE listing with a fixable problem. Retiring
    // one would silently stop repricing and restocking on a listing the seller
    // can still see on eBay — the expensive direction to be wrong in.
    const liveButRefused = [
      25019, // cannot revise the listing
      25097, // on hold for a policy violation
      25098, // parent listing on hold
      25026, // selling limits exceeded
      25003, // invalid price
      25004, // invalid quantity
      25005, // invalid category
    ];
    for (const errorId of liveButRefused) {
      expect(isEndedListingErrorId(errorId)).toBe(false);
      expect(isEndedListingFailure([errorId])).toBe(false);
    }
  });

  it('treats "no ids at all" as not ended', () => {
    // A transport failure reports one failure per listing in the batch with no
    // eBay ids. Without this, one eBay outage would retire a whole catalogue.
    expect(isEndedListingFailure([])).toBe(false);
  });

  it('ends the listing when a gone-id arrives alongside other errors', () => {
    expect(isEndedListingFailure([25003, 25713])).toBe(true);
  });
});
