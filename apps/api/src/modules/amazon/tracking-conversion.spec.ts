// apps/api/src/modules/amazon/tracking-conversion.spec.ts
import { AQUILINE_EBAY_CARRIER_CODE, AquilineProblemCode, ConversionOutcome } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';

import type { AquilineProfileService } from './aquiline-profile.service';
import { AquilineErrorKind, type AquilineClient } from './aquiline.client';
import {
  isPlanExhausted,
  isRetryableConversionFailure,
  TrackingConversionService,
} from './tracking-conversion.service';

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

describe('TrackingConversionService.resolveForOrder — Layer 1 persist failure', () => {
  // Finding 1 (fix round 1): a failed full-write persist must never be
  // reported as "conversion did not happen" — Aquiline has already issued
  // and billed the AQUA number by the time persistConverted runs.
  it('still returns the real converted number, tagged CONVERTED, when the full persist write throws', async () => {
    const orderRow = {
      id: 'order-1',
      user_id: 'user-1',
      ebay_account_id: 'ebay-1',
      auto_fulfill_status: 'placed',
      shipping_address: {
        fullName: 'Jane Buyer',
        street: '1 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62704',
        country: 'US',
      },
      converted_tracking_number: null,
      converted_tracking_carrier: null,
      tracking_provider_shipment_id: null,
      amazon_account_id: 'amz-1',
      amazon_order_id: 'AMZ-ORDER-1',
      amazon_order_url: null,
      amazon_tracking_url: 'https://www.amazon.com/gp/css/track?orderId=AMZ-ORDER-1',
      order_date: new Date('2026-08-01T00:00:00Z'),
      amazon_marketplace: 'AMAZON_US',
      amazon_account_email: 'buyer@example.com',
      listing_asin: null,
      listing_title: null,
    };

    const settingsRow = {
      tracking_conversion_provider: 'aquiline',
      tracking_provider_profile_id: null,
      tracking_conversion_scope: 'all',
      tracking_convert_manual_orders: true,
    };

    const queryMock = jest.fn((sql: string): unknown[] => {
      if (sql.includes('FROM orders o')) {
        return [orderRow];
      }
      if (sql.includes('FROM store_settings')) {
        return [settingsRow];
      }
      if (sql.includes('FROM aquiline_plan_snapshot')) {
        // No snapshot yet — isPlanExhausted reads this as "unknown", never
        // exhausted.
        return [];
      }
      if (sql.includes('tracking_provider_shipment_id')) {
        // Layer 1 (the full write) — simulate a DB blip.
        throw new Error('connection reset');
      }
      // Layer 2 minimal write, the plan-snapshot INSERT, and both diagnostic
      // stamps all succeed.
      return [];
    });
    const dbService = { query: queryMock } as unknown as DatabaseService;

    const aquilineClient = {
      isConfigured: () => true,
      upsertOrders: jest.fn().mockResolvedValue({ success: true }),
      uploadTrackingHtml: jest.fn(),
      assign: jest.fn().mockResolvedValue({
        aquiline: 'AQUAA1234567890YQ',
        chargedCents: 10,
        planLimit: 100,
        planUsed: 1,
        planRemaining: 99,
        reused: false,
      }),
    } as unknown as AquilineClient;

    const quotaEnforcement = {
      isSuspended: jest.fn().mockResolvedValue(false),
      canConvertTracking: jest.fn().mockResolvedValue({ allowed: true, used: 0, limitValue: 100 }),
    } as unknown as QuotaEnforcementService;

    const platformSettings = {
      getString: jest.fn().mockResolvedValue(null),
      getNumber: jest.fn().mockResolvedValue(null),
    } as unknown as PlatformSettingsService;

    const aquilineProfile = {
      ensureProfile: jest.fn().mockResolvedValue('sh-user-1-AMAZON_US'),
    } as unknown as AquilineProfileService;

    const service = new TrackingConversionService(
      dbService,
      platformSettings,
      aquilineClient,
      quotaEnforcement,
      aquilineProfile,
    );

    const result = await service.resolveForOrder({
      orderId: 'order-1',
      rawNumber: 'TBA123456789',
      rawCarrier: 'Amazon Logistics',
    });

    // The number Aquiline actually issued reaches the caller — never the
    // Amazon pass-through — and is tagged CONVERTED, not a pass-through
    // outcome, even though the local record of it never landed.
    expect(result.trackingNumber).toBe('AQUAA1234567890YQ');
    expect(result.shippingCarrierCode).toBe(AQUILINE_EBAY_CARRIER_CODE);
    expect(result.outcome).toBe(ConversionOutcome.CONVERTED);
    expect(result.outcome).not.toBe(ConversionOutcome.PASSTHROUGH_TERMINAL);
    expect(result.outcome).not.toBe(ConversionOutcome.PASSTHROUGH_RETRYABLE);

    // Layer 2's minimal write was attempted after Layer 1 failed.
    const layer2Call = queryMock.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('converted_tracking_carrier = $2 WHERE id = $3'),
    );
    expect(layer2Call).toBeDefined();
  });
});
