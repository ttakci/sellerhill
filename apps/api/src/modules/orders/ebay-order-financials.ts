/**
 * eBay order financial fields that arrive in the `getOrders` payload we already
 * download every sync tick, and that nothing read until now.
 *
 * Why they matter: `orders.transaction_fee` / `ad_fee` are DERIVED from the
 * `ebayFeePercent` / `fixedFeeAmount` a seller typed into their Listing
 * Settings Group — a pricing input, not a record of what eBay actually charged.
 * `totalMarketplaceFee` is the real figure and costs zero extra API calls.
 *
 * `ebayCollectAndRemitTaxes` is here for a narrower reason: eBay's own docs
 * contradict each other about whether Collect & Remit sales tax sits inside
 * `paymentSummary.totalDueSeller` for a Managed Payments seller (the
 * PaymentSummary type page says it does; the Collect & Remit announcement says
 * that for managed-payments sellers it "appears in the eBayCollectAndRemitTaxes
 * container only"). Every one of our sellers is Managed Payments and eBay US is
 * our only marketplace, so the answer decides whether `net_profit` is
 * overstated by the sales tax on every order. Capturing the number makes the
 * check exact arithmetic on the first real order rather than an inference from
 * an assumed fee percentage.
 *
 * NOTHING in this module feeds profit yet. It is capture only.
 */

/** eBay renders every money field as `{ value, currency }` with a string value. */
export interface EbayAmountLike {
  value?: string;
  currency?: string;
}

/** The only part of a line item this module reads. */
export interface EbayLineItemFeesLike {
  ebayCollectAndRemitTaxes?: Array<{ amount?: EbayAmountLike }>;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * eBay money → number, or `null` when eBay did not supply a usable value.
 *
 * The null/zero split is load-bearing and mirrors `orders.net_profit`: `0` means
 * eBay reported zero, `null` means eBay reported nothing. Defaulting an absent
 * field to 0 would make "this order had no fee" indistinguishable from "we never
 * captured the fee", which is exactly the question these columns exist to answer.
 */
export function parseEbayAmount(amount?: EbayAmountLike | null): number | null {
  const raw = amount?.value;
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Total eBay Collect & Remit tax across ALL line items, or `null` when no line
 * item reported one.
 *
 * Summed rather than read off `lineItems[0]`: the tax is charged per line item,
 * so a multi-item order would be understated by taking only the first — even
 * though `mapEbayOrderToEntity` reads the first line item for product data.
 */
export function sumCollectAndRemitTax(
  lineItems?: EbayLineItemFeesLike[] | null,
): number | null {
  if (!lineItems?.length) {
    return null;
  }

  let total = 0;
  let sawAny = false;

  for (const lineItem of lineItems) {
    for (const tax of lineItem?.ebayCollectAndRemitTaxes ?? []) {
      const amount = parseEbayAmount(tax?.amount);
      if (amount !== null) {
        total += amount;
        sawAny = true;
      }
    }
  }

  return sawAny ? round2(total) : null;
}
