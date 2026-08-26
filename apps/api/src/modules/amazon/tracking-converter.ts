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
  /**
   * Set only by the seller-initiated "convert this order's tracking" action.
   *
   * It bypasses the two rules that exist to infer intent — the per-store
   * "convert manually linked orders too" switch and the carrier scope — because
   * clicking the button on one order IS the intent those rules were guessing
   * at. Offering an action that then silently declines because of a default
   * would be worse than not offering it.
   *
   * It bypasses nothing else: an already-converted order is still returned
   * as-is rather than paid for twice, a suspended account is still refused, and
   * the monthly quota is still spent and still enforced.
   */
  forceManual?: boolean;
  /**
   * The real Amazon ship-track page URL, read from the order-details page's
   * own "Track package" link (never constructed) while the processor is
   * already there. Required by Aquiline's `assign` call. When absent (e.g.
   * the on-demand path, which has no live page), `TrackingConversionService`
   * falls back to the stored `orders.amazon_tracking_url` column.
   */
  trackingUrl?: string;
  /**
   * The ship-track page's HTML, captured in the same page visit as
   * `trackingUrl`. Optional: only the automatic (shipped-transition) path
   * captures it today, and `assign` may still succeed without a fresh upload
   * if Aquiline already has one on file. Fed to `uploadTrackingHtml` so
   * Aquiline can read the carrier/status off the page itself — there is no
   * separate carrier field on the Amazon assign body.
   */
  trackingHtml?: string;
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
 * Whether a tracking number came from Amazon Logistics.
 *
 * Extracted from `LocalTrackingConverter.convertSync`, which already had to
 * make exactly this call to pick the eBay carrier code. The scope setting
 * (`TrackingConversionScope.AMAZON_LOGISTICS_ONLY`) needs the same answer, and
 * the two must not be able to disagree — a second hand-written `TB` regex is
 * how "convert only Amazon Logistics" quietly starts converting a carrier the
 * carrier mapper calls UPS, or skipping one it calls Amazon.
 *
 * The TB-prefix test is deliberately broad (TBA/TBM/TBC/TBN/…): treating an
 * unknown TB* number as Amazon Logistics is always the safe direction, since
 * the cost of a false positive is one converted shipment while a false negative
 * leaves the supplier exposed.
 */
export function isAmazonLogisticsTracking(
  trackingNumber: string | null | undefined,
  carrier: string | null | undefined,
): boolean {
  const num = (trackingNumber || '').trim();
  const car = (carrier || '').trim();
  return /^TB[A-Z]/i.test(num) || /amazon/i.test(car);
}

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

    if (isAmazonLogisticsTracking(num, car)) {
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
