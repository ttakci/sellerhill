// apps/api/src/modules/amazon/tracking-conversion.spec.ts
import { AquilineProblemCode } from '@repo/shared';

import { AquilineErrorKind } from './aquiline.client';
import { isPlanExhausted, isRetryableConversionFailure } from './tracking-conversion.service';

describe('isRetryableConversionFailure', () => {
  it('retries a transport blip', () => {
    expect(isRetryableConversionFailure(AquilineErrorKind.TRANSPORT, null)).toBe(true);
  });

  it('retries "the HTML has not been parsed yet"', () => {
    // The whole reason the deferral exists: assign may refuse until the upload
    // is applied, and that would be a systematic first-attempt failure.
    expect(
      isRetryableConversionFailure(
        AquilineErrorKind.BAD_REQUEST,
        AquilineProblemCode.NEEDS_TRACKING_UPLOAD,
      ),
    ).toBe(true);
    expect(
      isRetryableConversionFailure(
        AquilineErrorKind.BAD_REQUEST,
        AquilineProblemCode.UPDATE_NOT_APPLIED,
      ),
    ).toBe(true);
  });

  it('does NOT retry a plan wall or a revoked token', () => {
    expect(isRetryableConversionFailure(AquilineErrorKind.QUOTA_EXCEEDED, null)).toBe(false);
    expect(isRetryableConversionFailure(AquilineErrorKind.UNAUTHORIZED, null)).toBe(false);
    expect(isRetryableConversionFailure(AquilineErrorKind.PROFILE_CEILING, null)).toBe(false);
  });

  it('does NOT retry a rejected page — the same page gets the same answer', () => {
    expect(
      isRetryableConversionFailure(
        AquilineErrorKind.BAD_REQUEST,
        AquilineProblemCode.WRONG_PAGE_TYPE,
      ),
    ).toBe(false);
  });
});

describe('isPlanExhausted', () => {
  it('short-circuits once the provider says nothing is left', () => {
    // Spending a call on a guaranteed 402 wastes a request and logs noise.
    expect(isPlanExhausted({ planRemaining: 0, capturedAt: new Date() }, new Date())).toBe(true);
  });

  it('clears once the snapshot is older than the provider window could be', () => {
    // Aquiline resets on the SUBSCRIPTION anniversary, not the 1st, so we
    // cannot compute the reset date from a calendar month. Expiring the
    // snapshot after 24h means at worst one wasted call per day re-learns the
    // real state, and a reset is never missed.
    const old = new Date('2026-08-01T00:00:00Z');
    expect(isPlanExhausted({ planRemaining: 0, capturedAt: old }, new Date('2026-08-03T00:00:00Z'))).toBe(
      false,
    );
  });

  it('does not short-circuit on an unknown remaining count', () => {
    expect(isPlanExhausted({ planRemaining: null, capturedAt: new Date() }, new Date())).toBe(false);
  });

  it('does not short-circuit when no snapshot has ever been captured', () => {
    expect(isPlanExhausted(null, new Date())).toBe(false);
  });
});
