import { TrackingConversionProvider } from '@repo/shared';

export interface ConverterResult {
  trackingNumber: string;
  shippingCarrierCode: string;
}

export interface TrackingConverter {
  convert(rawNumber: string, rawCarrier: string): ConverterResult;
}

/** Lowercased carrier label -> eBay carrier enum. */
const EBAY_CARRIER_MAP: Record<string, string> = {
  ups: 'UPS',
  usps: 'USPS',
  'u.s. postal service': 'USPS',
  'united states postal service': 'USPS',
  fedex: 'FedEx',
  'federal express': 'FedEx',
  dhl: 'DHL_Express',
  'dhl express': 'DHL_Express',
};

/**
 * Real-only converter. Real carriers (UPS/USPS/FedEx/DHL) are remapped to eBay's
 * enum. TBA/TBM/TBC (Amazon Logistics) are passed through unchanged under
 * Amazon_Logistics — NEVER fabricated into a USPS/UPS number (research 2026-07-18:
 * eBay deprecated Bluecare/Aquiline validation; fabricated numbers are fraud and
 * sink seller tracking/defect metrics).
 *
 * The TB-prefix guard matches any `TB[A-Z]` (TBA/TBM/TBC/TBN/TBR/…) — Amazon
 * Logistics uses several prefixes, and the anti-fraud-safe direction is to
 * classify all of them as Amazon_Logistics rather than risk fabricating a fake
 * USPS/UPS number for a real TB* prefix that the narrow regex missed.
 */
export class LocalTrackingConverter implements TrackingConverter {
  convert(rawNumber: string, rawCarrier: string): ConverterResult {
    const num = (rawNumber || '').trim();
    const car = (rawCarrier || '').trim();
    // Amazon Logistics: by number prefix OR carrier label.
    if (/^TB[A-Z]/i.test(num) || /amazon/i.test(car)) {
      return { trackingNumber: num, shippingCarrierCode: 'Amazon_Logistics' };
    }
    const mapped = EBAY_CARRIER_MAP[car.toLowerCase()];
    if (mapped) {
      return { trackingNumber: num, shippingCarrierCode: mapped };
    }
    // Real but unrecognized — pass through; eBay accepts/rejects server-side.
    return { trackingNumber: num, shippingCarrierCode: car || 'Other' };
  }
}

/** Reserved for a future sanctioned paid conversion API. Inactive — throws. */
export class ApiTrackingConverter implements TrackingConverter {
  convert(): ConverterResult {
    throw new Error('ApiTrackingConverter not implemented — no sanctioned provider configured');
  }
}

export function resolveConverter(provider: TrackingConversionProvider): TrackingConverter {
  return provider === TrackingConversionProvider.API
    ? new ApiTrackingConverter()
    : new LocalTrackingConverter();
}
