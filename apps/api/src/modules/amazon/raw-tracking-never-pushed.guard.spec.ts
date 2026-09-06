// apps/api/src/modules/amazon/raw-tracking-never-pushed.guard.spec.ts
//
// THE rule this whole feature exists for: when a conversion was expected and
// did not produce a number, the raw Amazon tracking number is NEVER pushed to
// eBay. A seller pays to keep their supplier hidden; handing the buyer the
// supplier's own tracking number defeats the entire product, and eBay's
// Fulfillment API has no update endpoint, so it can never be taken back.
//
// This is a guard spec because the rule was once the OPPOSITE. The processor
// used to push the raw number after a 12h window on the reasoning that
// "late-but-honest tracking beats no tracking at all" — a defensible-sounding
// sentence that traded the product's purpose for shipping-status timeliness
// nobody asked us to prioritise. A future reader optimising for eBay defect
// metrics could reintroduce it in one line; this spec is what stops them.

import { readFileSync } from 'fs';
import { join } from 'path';

import { ConversionOutcome, mayPushToEbay } from '@repo/shared';

const PROCESSOR = readFileSync(
  join(__dirname, 'amazon-tracking-processor.service.ts'),
  'utf8',
);

describe('mayPushToEbay', () => {
  it('allows a real conversion', () => {
    expect(mayPushToEbay(ConversionOutcome.CONVERTED)).toBe(true);
  });

  it('allows a pass-through the SELLER chose', () => {
    // Provider left on `local`, carrier outside their configured scope, or
    // conversion switched off for hand-linked orders. The raw number is the
    // intended, honest result — holding these would strand every order of
    // every seller who never enabled conversion.
    expect(mayPushToEbay(ConversionOutcome.PASSTHROUGH_NOT_REQUIRED)).toBe(true);
  });

  it('allows an unclassified result, which is the pure local converter', () => {
    expect(mayPushToEbay(undefined)).toBe(true);
  });

  it('REFUSES a conversion that was expected and failed', () => {
    // Suspended subscription, exhausted quota, missing API key, incomplete
    // ship-from address, no usable profile, provider plan exhausted.
    expect(mayPushToEbay(ConversionOutcome.PASSTHROUGH_FAILED)).toBe(false);
  });

  it('REFUSES a retryable failure', () => {
    expect(mayPushToEbay(ConversionOutcome.PASSTHROUGH_RETRYABLE)).toBe(false);
  });

  it('covers every outcome the enum defines', () => {
    // A new outcome added without deciding its push rule would silently take
    // the `undefined` branch and become pushable — exactly the direction that
    // exposes a supplier. Force the author to come here and choose.
    for (const outcome of Object.values(ConversionOutcome)) {
      expect(typeof mayPushToEbay(outcome)).toBe('boolean');
    }
    expect(Object.values(ConversionOutcome).sort()).toEqual(
      ['converted', 'passthrough_failed', 'passthrough_not_required', 'passthrough_retryable'].sort(),
    );
  });
});

describe('the shipped-transition processor', () => {
  it('gates its eBay push on mayPushToEbay', () => {
    expect(PROCESSOR).toMatch(/mayPushToEbay\s*\(/);
  });

  it('does not push on an expired deferral window', () => {
    // The removed behaviour, in the words it was written in. If either of
    // these reappears, the raw number is reaching buyers again.
    expect(PROCESSOR).not.toMatch(/late-but-honest/i);
    expect(PROCESSOR).not.toMatch(/past the\s*\n?\s*\/\/\s*window the push goes through/i);
  });
});
