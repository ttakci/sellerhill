import {
  AQUILINE_EBAY_CARRIER_CODE,
  AQUILINE_TRACKING_NUMBER_PATTERN,
  TrackingConversionProvider,
} from '@repo/shared';

import {
  AquilineTrackingConverter,
  isAmazonLogisticsTracking,
  isExternalProvider,
  LocalTrackingConverter,
  resolveConverter,
} from './tracking-converter';

const conv = new LocalTrackingConverter();
const req = (rawNumber: string, rawCarrier: string) => ({
  rawNumber,
  rawCarrier,
  orderId: 'order-1',
});

describe('LocalTrackingConverter', () => {
  it('remaps real UPS', () => {
    expect(conv.convertSync(req('1Z999AA10123456784', 'UPS'))).toEqual({
      trackingNumber: '1Z999AA10123456784',
      shippingCarrierCode: 'UPS',
      shipmentId: null,
    });
  });

  it('remaps real USPS (case-insensitive carrier)', () => {
    expect(conv.convertSync(req('9400111899223100000000', 'U.S. Postal Service'))).toEqual({
      trackingNumber: '9400111899223100000000',
      shippingCarrierCode: 'USPS',
      shipmentId: null,
    });
  });

  it('remaps FedEx and DHL', () => {
    expect(conv.convertSync(req('12345', 'FedEx')).shippingCarrierCode).toBe('FedEx');
    expect(conv.convertSync(req('12345', 'DHL')).shippingCarrierCode).toBe('DHL_Express');
  });

  it('passes TBA through as Amazon_Logistics (NO fabrication)', () => {
    const r = conv.convertSync(req('TBA123456789', 'Amazon Logistics'));
    expect(r).toEqual({
      trackingNumber: 'TBA123456789',
      shippingCarrierCode: 'Amazon_Logistics',
      shipmentId: null,
    });
    // Regression guard: the number is unchanged. Rewriting it into a fake
    // USPS/UPS number is fraud and eBay scores the unscannable result against
    // the seller. Hiding the supplier is the conversion provider's job.
    expect(r.trackingNumber).toBe('TBA123456789');
  });

  it('detects TBA by number prefix even with empty carrier', () => {
    expect(conv.convertSync(req('TBM000111222', '')).shippingCarrierCode).toBe('Amazon_Logistics');
  });

  it('passes unknown real carrier through under raw label', () => {
    const r = conv.convertSync(req('ABC123', 'OnTrac'));
    expect(r.trackingNumber).toBe('ABC123');
    expect(['OnTrac', 'Other']).toContain(r.shippingCarrierCode);
  });

  it('exposes the same result through the async interface', async () => {
    await expect(conv.convert(req('TBA999', 'Amazon Logistics'))).resolves.toEqual({
      trackingNumber: 'TBA999',
      shippingCarrierCode: 'Amazon_Logistics',
      shipmentId: null,
    });
  });
});

describe('resolveConverter', () => {
  it('returns Local for LOCAL', () => {
    expect(resolveConverter(TrackingConversionProvider.LOCAL)).toBeInstanceOf(LocalTrackingConverter);
  });

  it('returns the Aquiline marker for AQUILINE and the legacy API alias', () => {
    expect(resolveConverter(TrackingConversionProvider.AQUILINE)).toBeInstanceOf(
      AquilineTrackingConverter,
    );
    expect(resolveConverter(TrackingConversionProvider.API)).toBeInstanceOf(
      AquilineTrackingConverter,
    );
  });

  it('rejects a direct Aquiline convert instead of silently passing through', async () => {
    // The Aquiline path needs the buyer address, the seller profile and
    // durable persistence of a PAID result, so it can only run through
    // TrackingConversionService. Failing loudly here is what stops a caller
    // that bypasses the service from quietly shipping the raw Amazon number.
    await expect(
      resolveConverter(TrackingConversionProvider.AQUILINE).convert(req('TBA1', 'Amazon')),
    ).rejects.toThrow(/TrackingConversionService/);
  });
});

describe('isExternalProvider', () => {
  it('is true only for the provider values that mean "call out"', () => {
    expect(isExternalProvider(TrackingConversionProvider.AQUILINE)).toBe(true);
    expect(isExternalProvider(TrackingConversionProvider.API)).toBe(true);
    expect(isExternalProvider(TrackingConversionProvider.LOCAL)).toBe(false);
  });
});

describe('AQUILINE_EBAY_CARRIER_CODE', () => {
  it('matches the carrier name eBay shows in Add Tracking', () => {
    // Verified against a live eBay seller UI (2026-08-11): the Add-Tracking
    // dialog renders the carrier verbatim as "AQUILINE".
    expect(AQUILINE_EBAY_CARRIER_CODE).toBe('AQUILINE');
  });
});

describe('AQUILINE_TRACKING_NUMBER_PATTERN', () => {
  it('accepts BOTH attested prefixes', () => {
    // Two are in evidence and we do not know which is authoritative:
    // AQUAA… from a live eBay listing, AQAA… from the published OpenAPI
    // example. Matching only one would reject a valid number, and the
    // converter would then silently fall back to the pass-through — exposing
    // the supplier with nothing visibly broken. That is the bug this locks.
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQUAA6435850826YQ')).toBe(true);
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQUAA6215390826YQ')).toBe(true);
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQAA123456789YQ')).toBe(true);
  });

  it('still rejects real carrier numbers and Amazon Logistics numbers', () => {
    // The point of the check is to catch a response from the COURIER product
    // (a real carrier booking) instead of the conversion product.
    for (const bad of [
      'TBA123456789',
      '1Z999AA10123456784',
      '9400111899223100000000',
      '',
      'AQUILINE',
      'AQ12345',
    ]) {
      expect(AQUILINE_TRACKING_NUMBER_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('isAmazonLogisticsTracking', () => {
  // This predicate now decides TWO things: which eBay carrier code a
  // pass-through gets, and whether the AMAZON_LOGISTICS_ONLY conversion scope
  // pays for a shipment. They must never disagree, which is why there is one
  // function and not a second regex in the conversion service.
  it.each(['TBA123456789', 'TBM000111222', 'TBC999', 'tba123456789'])(
    'recognises the TB* family: %s',
    (num) => {
      expect(isAmazonLogisticsTracking(num, '')).toBe(true);
    },
  );

  it('recognises an Amazon carrier label regardless of number shape', () => {
    expect(isAmazonLogisticsTracking('9400111899223', 'Amazon Logistics')).toBe(true);
    expect(isAmazonLogisticsTracking('X1', 'AMZL')).toBe(false);
  });

  it('does not claim real carriers', () => {
    expect(isAmazonLogisticsTracking('1Z999AA10123456784', 'UPS')).toBe(false);
    expect(isAmazonLogisticsTracking('9400111899223', 'USPS')).toBe(false);
    expect(isAmazonLogisticsTracking('771234567890', 'FedEx')).toBe(false);
  });

  it('handles empty / missing input without claiming Amazon', () => {
    expect(isAmazonLogisticsTracking('', '')).toBe(false);
    expect(isAmazonLogisticsTracking(null, null)).toBe(false);
    expect(isAmazonLogisticsTracking(undefined, undefined)).toBe(false);
  });

  it('agrees with the carrier code the local converter picks', () => {
    // The invariant that matters: anything the mapper labels Amazon_Logistics
    // must also be in scope for AMAZON_LOGISTICS_ONLY, and vice versa.
    const converter = new LocalTrackingConverter();
    const cases: Array<[string, string]> = [
      ['TBA123456789', ''],
      ['1Z999AA10123456784', 'UPS'],
      ['9400111899223', 'USPS'],
      ['ANY', 'Amazon Logistics'],
    ];
    for (const [num, car] of cases) {
      const result = converter.convertSync({ rawNumber: num, rawCarrier: car, orderId: 'o1' });
      expect(result.shippingCarrierCode === 'Amazon_Logistics').toBe(
        isAmazonLogisticsTracking(num, car),
      );
    }
  });
});
