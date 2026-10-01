import type { EbayShippingFulfillment } from './ebay-fulfillment.service';

/**
 * Does eBay already hold a shipping fulfillment for this order line item?
 *
 * `createShippingFulfillment` is a POST with no idempotency key and no update
 * endpoint, so it must not be sent twice. It could be: a request that timed
 * out after eBay accepted it, a local write that failed after a successful
 * POST, or a seller who marked the order shipped on eBay by hand. Reading the
 * existing fulfillments first turns all three into "already done".
 *
 * A fulfillment counts when it names the line item. One that lists no line
 * items at all is counted too: the platform ships single-line orders, and
 * "eBay has a fulfillment for this order" is then the fact that matters —
 * sending a second one is the mistake to avoid.
 */
export function findFulfillmentForLineItem(
  fulfillments: EbayShippingFulfillment[] | null | undefined,
  lineItemId: string
): EbayShippingFulfillment | null {
  for (const fulfillment of fulfillments ?? []) {
    const lineItems = Array.isArray(fulfillment?.lineItems) ? fulfillment.lineItems : [];
    if (lineItems.length === 0 || lineItems.some((item) => item?.lineItemId === lineItemId)) {
      return fulfillment;
    }
  }
  return null;
}
