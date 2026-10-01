import { EbayReturnReasonType, EbayReturnSellerActivity, i18nResources, ReturnBucket } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  RETURN_ACTIVITY_OTHER_KEY,
  resolveReasonTypeKey,
  resolveSellerActivityKey,
  returnBucketPresentation,
} from './return-presentation';

describe('returnBucketPresentation', () => {
  it('gives every bucket an icon and a badge variant', () => {
    for (const bucket of Object.values(ReturnBucket)) {
      const p = returnBucketPresentation(bucket);
      expect({ bucket, icon: typeof p.icon, variant: typeof p.variant }).toEqual({
        bucket,
        icon: 'string',
        variant: 'string',
      });
      expect(p.icon.length).toBeGreaterThan(0);
    }
  });

  it('renders a missed deadline and an escalation red, an open action amber, a closed return grey', () => {
    expect(returnBucketPresentation(ReturnBucket.ACTION_OVERDUE).variant).toBe('error');
    expect(returnBucketPresentation(ReturnBucket.ESCALATED).variant).toBe('orange');
    expect(returnBucketPresentation(ReturnBucket.ACTION_DUE).variant).toBe('warning');
    expect(returnBucketPresentation(ReturnBucket.IN_PROGRESS).variant).toBe('sky');
    expect(returnBucketPresentation(ReturnBucket.CLOSED).variant).toBe('success');
  });

  it('renders an unconfirmed return grey, and apart from a closed one by icon', () => {
    expect(returnBucketPresentation(ReturnBucket.UNCONFIRMED).variant).toBe('neutral');
    expect(returnBucketPresentation(ReturnBucket.UNCONFIRMED).icon).not.toBe(
      returnBucketPresentation(ReturnBucket.CLOSED).icon
    );
  });

  it('tells the two red buckets apart by icon', () => {
    expect(returnBucketPresentation(ReturnBucket.ACTION_OVERDUE).icon).not.toBe(
      returnBucketPresentation(ReturnBucket.ESCALATED).icon
    );
  });
});

describe('resolveSellerActivityKey', () => {
  it('keeps every seller activity eBay documents', () => {
    for (const activity of Object.values(EbayReturnSellerActivity)) {
      expect(resolveSellerActivityKey(activity)).toBe(activity);
    }
  });

  it('maps any other eBay activity to the generic wording instead of a raw enum', () => {
    expect(resolveSellerActivityKey('SELLER_SEND_MESSAGE')).toBe(RETURN_ACTIVITY_OTHER_KEY);
    expect(resolveSellerActivityKey('SOMETHING_EBAY_ADDED_LATER')).toBe(RETURN_ACTIVITY_OTHER_KEY);
  });

  it('reads "nothing due" as null', () => {
    expect(resolveSellerActivityKey(null)).toBeNull();
    expect(resolveSellerActivityKey(undefined)).toBeNull();
    expect(resolveSellerActivityKey('')).toBeNull();
  });
});

describe('resolveReasonTypeKey', () => {
  it('keeps the documented categories and falls back to UNKNOWN', () => {
    for (const reasonType of Object.values(EbayReturnReasonType)) {
      expect(resolveReasonTypeKey(reasonType)).toBe(reasonType);
    }
    expect(resolveReasonTypeKey('NEW_CATEGORY')).toBe(EbayReturnReasonType.UNKNOWN);
    expect(resolveReasonTypeKey(null)).toBe(EbayReturnReasonType.UNKNOWN);
  });
});

describe('returns i18n coverage', () => {
  const en = i18nResources.en.returns.returns;

  it('has a label and a hint for every bucket', () => {
    for (const bucket of Object.values(ReturnBucket)) {
      expect(en.bucket[bucket]).toBeTruthy();
      expect(en.bucketHint[bucket]).toBeTruthy();
    }
  });

  it('has copy for every seller activity, plus the generic one', () => {
    const activity: Record<string, string> = en.activity;
    for (const key of [...Object.values(EbayReturnSellerActivity), RETURN_ACTIVITY_OTHER_KEY]) {
      expect(activity[key]).toBeTruthy();
    }
  });

  it('has copy for every reason category', () => {
    for (const reasonType of Object.values(EbayReturnReasonType)) {
      expect(en.reasonType[reasonType]).toBeTruthy();
    }
  });
});
