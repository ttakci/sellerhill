import { CancellationBucket } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  cancellationBucketPresentation,
  resolveCancellationReasonKey,
  resolveHistoryActivityKey,
  resolveHistoryActor,
} from './cancellation-presentation';

describe('cancellationBucketPresentation', () => {
  it('has a badge for every bucket, one colour per meaning', () => {
    const variants = Object.values(CancellationBucket).map((b) => cancellationBucketPresentation(b).variant);
    expect(new Set(variants).size).toBe(variants.length);
  });
});

describe('resolveCancellationReasonKey', () => {
  it('keeps the three known reasons and reads anything else as "other"', () => {
    expect(resolveCancellationReasonKey('BUYER_ASKED_CANCEL')).toBe('BUYER_ASKED_CANCEL');
    expect(resolveCancellationReasonKey('OUT_OF_STOCK_OR_CANNOT_FULFILL')).toBe('OUT_OF_STOCK_OR_CANNOT_FULFILL');
    expect(resolveCancellationReasonKey('SOMETHING_NEW')).toBe('other');
    expect(resolveCancellationReasonKey(null)).toBe('other');
  });
});

describe('journey steps', () => {
  it('names the actor from eBay\'s party, then the activity prefix, else eBay', () => {
    expect(resolveHistoryActor('BUYER', 'SELLER_CREATE_CANCEL')).toBe('buyer');
    expect(resolveHistoryActor(null, 'SELLER_CREATE_CANCEL')).toBe('seller');
    expect(resolveHistoryActor('UNKNOWN', 'SYSTEM_REFUND')).toBe('ebay');
  });

  it('words the documented steps and falls back to a generic line per actor', () => {
    expect(resolveHistoryActivityKey('SYSTEM_REFUND', 'ebay')).toBe('SYSTEM_REFUND');
    expect(resolveHistoryActivityKey('BUYER_SOMETHING', 'buyer')).toBe('buyerOther');
    expect(resolveHistoryActivityKey(null, 'ebay')).toBe('ebayOther');
  });
});
