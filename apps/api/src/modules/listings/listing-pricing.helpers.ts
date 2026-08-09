/**
 * Pure price/quantity resolution for the refresh fan-out.
 *
 * These two decisions — "what should this listing cost and stock right now"
 * and "did that actually change" — used to live inline in the body of
 * `ProductSyncService.updateAllListingsForProduct`'s loop, which made them
 * untestable and impossible to reuse from a batched push. They are extracted
 * verbatim here, with one deliberate behavior change called out on
 * `hasCommerceDelta`.
 */

/** Commerce figures the strategy produces before per-listing overrides. */
export interface StrategyCommerce {
  price: number;
  quantity: number;
  purchasePrice: number;
  estimatedProfit: number;
  profitMargin: number;
  roi: number;
}

/**
 * The override columns carried on a `listings` row (migration 029), as read
 * back by `pg` — NUMERIC arrives as a string, INTEGER as a number.
 */
export interface ListingOverrideRow {
  price: string | number | null;
  quantity: number | null;
  disable_ordering: boolean;
  disable_repricing: boolean;
  lock_price: boolean;
  lock_quantity: boolean;
  price_override: string | number | null;
  quantity_override: number | null;
  margin_percent_override: string | number | null;
  margin_fixed_override: string | number | null;
}

/**
 * eBay carries prices to two decimals, so a delta under half a cent is noise,
 * not a change worth an API call.
 */
export const PRICE_EPSILON = 0.005;

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Profit metrics recomputed against a price the seller pinned rather than one we derived. */
function metricsAgainstCost(finalPrice: number, cost: number): Omit<StrategyCommerce, 'price' | 'quantity'> {
  const estimatedProfit = finalPrice - cost;
  return {
    purchasePrice: cost,
    estimatedProfit,
    profitMargin: finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0,
    roi: cost > 0 ? (estimatedProfit / cost) * 100 : 0,
  };
}

/**
 * Apply a listing's own automation overrides on top of the group strategy.
 *
 * Precedence (unchanged from the original inline block):
 * - `disable_ordering` forces quantity 0 and outranks every quantity rule.
 * - `lock_quantity` pins the override, else the listing's current quantity.
 * - `disable_repricing` / `lock_price` pin the price override, else the
 *   listing's current price, and profit is recomputed against Amazon cost.
 * - A margin override applies only when the price is NOT locked.
 *
 * Known wart, preserved on purpose: the margin branch multiplies Amazon cost
 * directly and therefore bypasses `applyFees` and the $0.99 floor that
 * `calculatePrice` enforces. Changing that would silently reprice every
 * listing using a margin override, so it stays a separate decision.
 */
export function applyListingOverrides(strategy: StrategyCommerce, row: ListingOverrideRow): StrategyCommerce {
  let quantity = strategy.quantity;
  if (row.disable_ordering) {
    quantity = 0;
  } else if (row.lock_quantity) {
    quantity = toNumber(row.quantity_override) ?? toNumber(row.quantity) ?? 0;
  }

  if (row.disable_repricing || row.lock_price) {
    const pinned = toNumber(row.price_override) ?? toNumber(row.price);
    const price = pinned ?? strategy.price;
    return { price, quantity, ...metricsAgainstCost(price, strategy.purchasePrice) };
  }

  if (row.margin_percent_override !== null || row.margin_fixed_override !== null) {
    const cost = strategy.purchasePrice;
    const percent = toNumber(row.margin_percent_override) ?? 0;
    const fixed = toNumber(row.margin_fixed_override) ?? 0;
    const price = cost * (1 + percent / 100) + fixed;
    return { price, quantity, ...metricsAgainstCost(price, cost) };
  }

  return { ...strategy, quantity };
}

/**
 * Is this listing's price or quantity actually different from what eBay holds?
 *
 * The original compared `String(row.price) !== String(finalPrice)`, which reads
 * the NUMERIC column back as `"12.30"` and the computed value as `12.3` and
 * calls them different — so every refresh cycle pushed a "change" that changed
 * nothing, multiplying eBay call volume for free. Compare numerically instead,
 * with a sub-cent tolerance.
 *
 * A NULL current price/quantity counts as changed: we have nothing on record to
 * prove eBay already holds the value.
 */
export function hasCommerceDelta(
  current: { price: string | number | null; quantity: number | null },
  next: { price: number; quantity: number }
): boolean {
  const currentPrice = toNumber(current.price);
  const currentQuantity = toNumber(current.quantity);

  if (currentPrice === null || currentQuantity === null) {
    return true;
  }
  return Math.abs(currentPrice - next.price) >= PRICE_EPSILON || currentQuantity !== next.quantity;
}
