import {
  EBAY_RETURN_CLOSE_REASONS,
  EBAY_RETURN_HISTORY_ACTIVITIES,
  EBAY_RETURN_TYPES,
  EbayReturnAction,
  EbayReturnReasonType,
  EbayReturnSellerActivity,
  i18nResources,
  ReturnBucket,
} from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  RETURN_ACTIVITY_OTHER_KEY,
  resolveCloseReasonKey,
  resolveHistoryActivityKey,
  resolveHistoryActor,
  resolveReasonTypeKey,
  resolveReturnTypeKey,
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
    expect(resolveSellerActivityKey('SELLER_VOID_LABEL')).toBe(RETURN_ACTIVITY_OTHER_KEY);
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

describe('history and detail keys', () => {
  it('reads the actor from the activity prefix and falls back per actor', () => {
    expect(resolveHistoryActor('BUYER_CREATE_RETURN')).toBe('buyer');
    expect(resolveHistoryActor('SELLER_ISSUE_REFUND')).toBe('seller');
    expect(resolveHistoryActor('SYSTEM_CLOSE_RETURN')).toBe('ebay');
    expect(resolveHistoryActor(null)).toBe('ebay');
    expect(resolveHistoryActivityKey('BUYER_CREATE_RETURN')).toBe('BUYER_CREATE_RETURN');
    expect(resolveHistoryActivityKey('BUYER_VOID_LABEL')).toBe('buyerOther');
    expect(resolveHistoryActivityKey('SELLER_VOID_LABEL')).toBe('sellerOther');
    expect(resolveHistoryActivityKey('SYSTEM_SELLER_CHARGE')).toBe('ebayOther');
  });

  it('localizes the documented return types and close reasons, nothing else', () => {
    expect(resolveReturnTypeKey('MONEY_BACK')).toBe('MONEY_BACK');
    expect(resolveReturnTypeKey('WSDL')).toBeNull();
    expect(resolveCloseReasonKey('FULL_REFUNDED')).toBe('FULL_REFUNDED');
    expect(resolveCloseReasonKey('SOMETHING_NEW')).toBe('other');
  });
});

describe('returns i18n coverage', () => {
  const en = i18nResources.en.returns.returns;

  it('has a past-tense line for every history activity the page localizes, plus the three fallbacks', () => {
    for (const activity of [...EBAY_RETURN_HISTORY_ACTIVITIES, 'buyerOther', 'sellerOther', 'ebayOther']) {
      expect(en.history[activity as keyof typeof en.history]).toBeTruthy();
    }
    for (const type of EBAY_RETURN_TYPES) {
      expect(en.returnType[type]).toBeTruthy();
    }
    for (const reason of [...EBAY_RETURN_CLOSE_REASONS, 'other']) {
      expect(en.closeReason[reason as keyof typeof en.closeReason]).toBeTruthy();
    }
    for (const action of Object.values(EbayReturnAction)) {
      expect(en.form.choice[action]).toBeTruthy();
      expect(en.actions.done[action]).toBeTruthy();
    }
  });

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
