import { CancellationBucket } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  cancellationBucketPresentation,
  resolveCancellationReasonKey,
  resolveHistoryActivityKey,
  resolveHistoryActor,
  upcomingCancellationSteps,
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

describe('upcomingCancellationSteps', () => {
  const asked = { activity: 'BUYER_CREATE_CANCEL', party: 'BUYER' };
  const approved = { activity: 'SELLER_APPROVE', party: 'SELLER' };
  const refunded = { activity: 'SYSTEM_REFUND', party: 'SYSTEM' };

  it('names the live steps seen on 2026-10-07', () => {
    expect(resolveHistoryActivityKey('BUYER_CREATE_CANCEL', 'buyer')).toBe('BUYER_CREATE_CANCEL');
    expect(resolveHistoryActivityKey('SELLER_APPROVE', 'seller')).toBe('SELLER_APPROVE');
  });

  it('expects the answer, the refund and the close before the seller answers', () => {
    expect(upcomingCancellationSteps([asked], false)).toEqual(['answer', 'refund', 'close']);
  });

  it('expects the refund and the close after an approval, the close once eBay refunded', () => {
    expect(upcomingCancellationSteps([asked, approved], false)).toEqual(['refund', 'close']);
    expect(upcomingCancellationSteps([asked, approved, refunded], false)).toEqual(['close']);
  });

  it('expects only the close after any other seller answer — no refund follows a decline', () => {
    expect(upcomingCancellationSteps([asked, { activity: 'SELLER_SOMETHING', party: 'SELLER' }], false)).toEqual([
      'close',
    ]);
  });

  it('has nothing ahead of a closed request', () => {
    expect(upcomingCancellationSteps([asked], true)).toEqual([]);
  });
});
