import {
  AQUILINE_EBAY_CARRIER_CODE,
  TrackingConversionProvider,
  type TrackingConversionResult,
} from '@repo/shared';

/** Everything a converter needs. Carries order context because an external
 *  provider bills per conversion and must be called idempotently. */
export interface ConversionRequest {
  /** Amazon's tracking number. */
  rawNumber: string;
  /** Amazon's carrier label, e.g. "Amazon Logistics". */
  rawCarrier: string;
  /** Our order id — the provider's external reference and idempotency seed. */
  orderId: string;
}

/**
 * Turns an Amazon tracking number into the number the eBay buyer sees.
 *
 * ASYNC BY CONTRACT. It used to be a synchronous pure function, which was only
 * possible while the sole implementation was a local string transform. An
 * external provider is a paid network call, so the interface has to admit
 * one — and every caller has to be prepared for it to fail.
 */
export interface TrackingConverter {
  convert(request: ConversionRequest): Promise<TrackingConversionResult>;
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
 * Pass-through converter — the honest default and the fallback for every
 * external failure.
 *
 * Real carriers (UPS/USPS/FedEx/DHL) are remapped to eBay's enum. Amazon
 * Logistics numbers (any `TB[A-Z]` prefix — TBA/TBM/TBC/TBN/…) pass through
 * unchanged under `Amazon_Logistics`.
 *
 * A tracking number is NEVER fabricated here. Inventing a USPS/UPS number for
 * a parcel that carrier never handled is fraud, and eBay scores the resulting
 * unscannable tracking against the seller. Hiding the supplier is a job for a
 * real conversion service that issues a number it actually tracks — see
 * `AquilineTrackingConverter` — not for string manipulation.
 *
 * The TB-prefix guard is deliberately broad: classifying an unknown TB* number
 * as Amazon Logistics is always safe, while a narrow regex that missed one
 * would fall through to the carrier-label branch and mislabel it.
 */
export class LocalTrackingConverter implements TrackingConverter {
  convert(request: ConversionRequest): Promise<TrackingConversionResult> {
    return Promise.resolve(this.convertSync(request));
  }

  /** Sync form — used directly as the fallback path inside other converters. */
  convertSync(request: ConversionRequest): TrackingConversionResult {
    const num = (request.rawNumber || '').trim();
    const car = (request.rawCarrier || '').trim();

    if (/^TB[A-Z]/i.test(num) || /amazon/i.test(car)) {
      return { trackingNumber: num, shippingCarrierCode: 'Amazon_Logistics', shipmentId: null };
    }
    const mapped = EBAY_CARRIER_MAP[car.toLowerCase()];
    if (mapped) {
      return { trackingNumber: num, shippingCarrierCode: mapped, shipmentId: null };
    }
    // Real but unrecognised — pass through; eBay accepts/rejects server-side.
    return { trackingNumber: num, shippingCarrierCode: car || 'Other', shipmentId: null };
  }
}

/**
 * Marker for the Aquiline path.
 *
 * The real work cannot live in a converter object: it needs the buyer address,
 * the resolved seller profile, and it must persist its result before the
 * number reaches eBay. That belongs in `TrackingConversionService`, which owns
 * the DB. This class exists so `resolveConverter` keeps a total mapping over
 * the enum and so a caller that bypasses the service fails loudly instead of
 * silently pushing an unconverted Amazon number to the buyer.
 */
export class AquilineTrackingConverter implements TrackingConverter {
  convert(): Promise<TrackingConversionResult> {
    return Promise.reject(
      new Error(
        'AquilineTrackingConverter must be driven by TrackingConversionService — ' +
          'it needs the buyer address, the seller profile and durable persistence of the paid result',
      ),
    );
  }
}

/** eBay carrier code for an Aquiline number, re-exported for call sites. */
export { AQUILINE_EBAY_CARRIER_CODE };

export function resolveConverter(provider: TrackingConversionProvider): TrackingConverter {
  switch (provider) {
    case TrackingConversionProvider.AQUILINE:
    case TrackingConversionProvider.API:
      return new AquilineTrackingConverter();
    case TrackingConversionProvider.LOCAL:
    default:
      return new LocalTrackingConverter();
  }
}

/** Whether a provider value means "call the external conversion service". */
export function isExternalProvider(provider: TrackingConversionProvider): boolean {
  return (
    provider === TrackingConversionProvider.AQUILINE || provider === TrackingConversionProvider.API
  );
}
