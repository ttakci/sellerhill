import type { FeeConfig, PriceRange } from '../domain/listing-settings-groups/listing-settings-group.types';

/**
 * Every intermediate figure `calculateListingPrice` passes through on its way
 * from an Amazon price to an eBay price — the numbers behind the formula, not
 * just its result. Exists so a caller (the Listing Settings Group drawer's
 * calculator) can show its work — "why is my eBay price $27.93" — without
 * re-deriving the math itself, which would risk a second copy drifting from
 * the real one.
 */
export interface ListingPriceBreakdown {
  amazonPrice: number;
  amazonTaxRatePct: number;
  /** amazonPrice × amazonTaxRatePct / 100. */
  taxAmount: number;
  /** amazonPrice + taxAmount — the real acquisition cost. */
  trueCost: number;
  /** True when no configured range covered `amazonPrice`, so the 20% default margin was used. */
  usedFallbackMargin: boolean;
  profitMarginPercent: number;
  /** Dollar amount the percentage margin added on top of trueCost. */
  marginAmount: number;
  fixedProfitAmount: number;
  /** trueCost + marginAmount + fixedProfitAmount — what applyEbayFees is asked to net. */
  netTarget: number;
  ebayFeePercent: number;
  /** finalPrice × ebayFeePercent / 100 — what eBay keeps from the sale. */
  ebayFeeAmount: number;
  fixedFeeAmount: number;
  /** The promoted-listing ad rate folded into the price (0 when the listing is in no campaign). */
  adRatePercent: number;
  /** price × adRatePercent / 100 — what the ad costs the seller per sale. */
  adFeeAmount: number;
  /** The reverse-fee result before the $0.99 floor could apply. */
  priceBeforeFloor: number;
  minPriceFloorApplied: boolean;
  /** True when the group's price-ending rule moved the price. */
  priceRoundingApplied: boolean;
  /** The configured ending (0–99), or null when rounding is off. */
  priceEndingCents: number | null;
  /** The price right before the ending rule (after the floor). */
  priceBeforeRounding: number;
  /** finalPrice − priceBeforeRounding; never negative. */
  roundingAmount: number;
  finalPrice: number;
}

/**
 * The single source of truth for "what does this Amazon price become on eBay,
 * given this settings group". `ListingStrategyService.calculatePrice` (API,
 * the real create/refresh path) and the Listing Settings Group drawer's price
 * calculator (web, an unsaved what-if preview) both call this — never two
 * copies of the same formula drifting apart.
 */
export interface ListingPriceMetrics {
  /** What the buyer pays on eBay. */
  finalPrice: number;
  /** The raw Amazon price, before tax. */
  purchasePrice: number;
  /** Profit net of the true cost (Amazon price + estimated purchase tax). */
  estimatedProfit: number;
  /** estimatedProfit as a percentage of finalPrice. */
  profitMargin: number;
  /** estimatedProfit as a percentage of the true cost. */
  roi: number;
  /** Every intermediate figure behind the numbers above — see `ListingPriceBreakdown`. */
  breakdown: ListingPriceBreakdown;
}

/**
 * Add eBay's percentage fee and fixed fee to a target net using a reverse
 * calculation, so that after eBay takes its cut the seller is left with
 * exactly `netTarget`.
 *
 * Formula: SalePrice = (NetTarget + FixedFee) / (1 - (EbayFee% + AdRate%) / 100)
 */
export function applyEbayFees(netTarget: number, fees: FeeConfig, adRatePct = 0): number {
  const ebayFeePercent = Number(fees?.ebayFeePercent) || 0;
  const fixedFeeAmount = Number(fees?.fixedFeeAmount) || 0;

  const percentageDeduction = (ebayFeePercent + (Number(adRatePct) || 0)) / 100;

  // Guard against division by zero/negative if the fee is 100% or more.
  if (percentageDeduction >= 1) {
    return netTarget * 1.5;
  }

  const finalPrice = (netTarget + fixedFeeAmount) / (1 - percentageDeduction);
  return Math.round(finalPrice * 100) / 100;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The group's price ending as whole cents (0–99), or null when rounding is
 * off or the stored value is unusable — a bad value must read as "off", never
 * as a wrong price.
 */
export function resolvePriceEndingCents(fees: FeeConfig | null | undefined): number | null {
  if (!fees?.priceRoundingEnabled) {
    return null;
  }
  const cents = Number(fees.priceEndingCents);
  return Number.isInteger(cents) && cents >= 0 && cents <= 99 ? cents : null;
}

/**
 * Round a price UP to the next amount ending in `endingCents` (99 → $x.99).
 * Up, never to the nearest: rounding down would cut the seller's target
 * profit, while rounding up adds at most 99 cents. Done in integer cents so
 * no float drift can push a price that already has the ending a dollar up.
 */
export function applyPriceEnding(price: number, endingCents: number): number {
  const priceCents = Math.round(price * 100);
  let candidate = Math.floor(priceCents / 100) * 100 + endingCents;
  if (candidate < priceCents) {
    candidate += 100;
  }
  return candidate / 100;
}

/**
 * Calculate the eBay list price + profit metrics for one Amazon price under
 * a settings group's repricing strategy, fees, and the estimated Amazon
 * purchase-tax rate (Store Settings → Amazon Satış Alış Vergi Oranı).
 *
 * @param amazonTaxRatePct Percentage tax paid AT PURCHASE on Amazon — a real
 * acquisition cost, so it raises the cost basis here (not just the post-sale
 * provisional profit estimate). 0 when unknown/not configured.
 * @param adRatePct Promoted Listings ad rate the listing is currently
 * advertised at; added to eBay's percentage in the reverse-fee divisor so the
 * seller's profit is unchanged by the ad. 0 = not promoted (the old formula).
 */
export function calculateListingPrice(
  amazonPrice: number,
  repricingStrategy: readonly PriceRange[],
  fees: FeeConfig,
  amazonTaxRatePct: number,
  adRatePct = 0
): ListingPriceMetrics {
  const taxRatePct = Number(amazonTaxRatePct) || 0;
  const taxAmount = amazonPrice * (taxRatePct / 100);
  // The real acquisition cost: what Amazon actually charges, tax included.
  const trueCost = amazonPrice + taxAmount;

  // Bucketed by the raw Amazon price, not the tax-inclusive cost: ranges
  // classify the PRODUCT's price tier, which tax doesn't change.
  const range = repricingStrategy.find((r) => amazonPrice >= r.minPrice && amazonPrice <= r.maxPrice);

  let profitMarginPercent = 0;
  let marginAmount = 0;
  let fixedProfitAmount = 0;
  const usedFallbackMargin = !range;

  if (!range) {
    // Fallback: a default 20% margin when the price falls outside every
    // configured range.
    profitMarginPercent = 20;
    marginAmount = trueCost * 0.2;
  } else {
    if (range.profitMarginPercent) {
      profitMarginPercent = range.profitMarginPercent;
      marginAmount = trueCost * (range.profitMarginPercent / 100);
    }
    if (range.fixedProfitAmount) {
      fixedProfitAmount = range.fixedProfitAmount;
    }
  }

  const netTarget = trueCost + marginAmount + fixedProfitAmount;

  const ebayFeePercent = Number(fees?.ebayFeePercent) || 0;
  const fixedFeeAmount = Number(fees?.fixedFeeAmount) || 0;
  const adRatePercent = Math.max(Number(adRatePct) || 0, 0);
  const priceBeforeFloor = applyEbayFees(netTarget, fees, adRatePercent);

  // Enforce minimum price (eBay requirement: typically $0.99 for USD).
  const minPrice = 0.99;
  const minPriceFloorApplied = priceBeforeFloor < minPrice;
  const priceBeforeRounding = minPriceFloorApplied ? minPrice : priceBeforeFloor;

  // Price ending last, after the floor: it only ever moves the price up, so
  // it can never undo the floor or the seller's target.
  const priceEndingCents = resolvePriceEndingCents(fees);
  const finalPrice =
    priceEndingCents === null ? priceBeforeRounding : applyPriceEnding(priceBeforeRounding, priceEndingCents);
  const roundingAmount = round2(finalPrice - priceBeforeRounding);
  const priceRoundingApplied = roundingAmount > 0;

  const feeBase = priceRoundingApplied ? finalPrice : priceBeforeFloor;
  const ebayFeeAmount = feeBase * (ebayFeePercent / 100);
  const adFeeAmount = feeBase * (adRatePercent / 100);

  // Profit net of the TRUE cost (Amazon price + tax), so the tax markup
  // above is never counted as profit. The cents the ending rule added are
  // real extra revenue, less eBay's percentage on them.
  const estimatedProfit = netTarget - trueCost + roundingAmount * Math.max(1 - (ebayFeePercent + adRatePercent) / 100, 0);
  const profitMargin = finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0;
  const roi = trueCost > 0 ? (estimatedProfit / trueCost) * 100 : 0;

  return {
    finalPrice,
    purchasePrice: amazonPrice,
    estimatedProfit: round2(estimatedProfit),
    profitMargin: round2(profitMargin),
    roi: round2(roi),
    breakdown: {
      amazonPrice,
      amazonTaxRatePct: taxRatePct,
      taxAmount: round2(taxAmount),
      trueCost: round2(trueCost),
      usedFallbackMargin,
      profitMarginPercent,
      marginAmount: round2(marginAmount),
      fixedProfitAmount,
      netTarget: round2(netTarget),
      ebayFeePercent,
      ebayFeeAmount: round2(ebayFeeAmount),
      fixedFeeAmount,
      adRatePercent,
      adFeeAmount: round2(adFeeAmount),
      priceBeforeFloor: round2(priceBeforeFloor),
      minPriceFloorApplied,
      priceRoundingApplied,
      priceEndingCents,
      priceBeforeRounding: round2(priceBeforeRounding),
      roundingAmount,
      finalPrice,
    },
  };
}
