// apps/api/src/modules/billing/stripe-catalog-sync.ts
//
// Mirror the local billing catalog into Stripe, and verify what is already
// mirrored.
//
// Shared by the operator CLI (`pnpm --filter api stripe:sync-catalog`) and the
// automatic price-migration job, which runs it first so that a price change
// shipped by migration reaches Stripe — and then existing subscribers — with no
// command for anyone to remember. One implementation, because two copies of
// "what does a Stripe Price for this row look like" is exactly how the app and
// Stripe end up disagreeing about what something costs.
//
// Idempotent: a row that already has a Stripe id is never re-created (a Stripe
// Price is immutable); it is VERIFIED instead, and any amount/currency that no
// longer matches is reported rather than silently accepted.

import type Stripe from 'stripe';

/** Products are created with the SaaS tax code rather than Stripe's too-broad default. */
export const SAAS_TAX_CODE = 'txcd_10103001';

/** The only database access this needs — satisfied by a pg Pool or DatabaseService. */
export type CatalogQuery = <T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;

interface PlanRow extends Record<string, unknown> {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider_product_id: string | null;
}

interface PriceRow extends Record<string, unknown> {
  id: string;
  interval: 'monthly' | 'annual';
  amount_micros: string;
  currency: string;
  provider_price_id: string | null;
}

interface AddonRow extends Record<string, unknown> {
  id: string;
  slug: string;
  limit_key: string;
  quantity: string;
  amount_micros: string;
  currency: string;
  provider_price_id: string | null;
}

export interface CatalogSyncResult {
  /** Stripe Products/Prices minted this run. */
  created: string[];
  /** Mirrored rows whose Stripe Price no longer matches the local amount. */
  mismatches: string[];
}

/** amount_micros is 1/1,000,000 of the major unit; Stripe wants minor units. */
function toUnitAmount(amountMicros: string): number {
  return Math.round(Number(amountMicros) / 10_000);
}

async function verifyPrice(
  stripe: Stripe,
  label: string,
  providerPriceId: string,
  expectedUnitAmount: number,
  expectedCurrency: string,
): Promise<string | null> {
  try {
    const remote = await stripe.prices.retrieve(providerPriceId);
    if (
      remote.unit_amount === expectedUnitAmount &&
      remote.currency === expectedCurrency.toLowerCase()
    ) {
      return null;
    }
    return (
      `${label}: local ${expectedUnitAmount} ${expectedCurrency.toUpperCase()} ` +
      `vs Stripe ${String(remote.unit_amount)} ${remote.currency.toUpperCase()} (${providerPriceId})`
    );
  } catch (error: unknown) {
    // An unreadable answer is reported, never treated as agreement.
    return `${label}: could not read Stripe Price ${providerPriceId} — ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

export async function syncStripeCatalog(
  query: CatalogQuery,
  stripe: Stripe,
): Promise<CatalogSyncResult> {
  const result: CatalogSyncResult = { created: [], mismatches: [] };

  const plans = await query<PlanRow>(
    `SELECT id, slug, name, description, provider_product_id
       FROM billing_plans WHERE is_active = TRUE ORDER BY display_order ASC`,
  );

  for (const plan of plans) {
    let productId = plan.provider_product_id;
    if (!productId) {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description ?? undefined,
        tax_code: SAAS_TAX_CODE,
        metadata: { plan_id: plan.id, plan_slug: plan.slug },
      });
      productId = product.id;
      await query(
        `UPDATE billing_plans SET provider_product_id = $1, updated_at = NOW() WHERE id = $2`,
        [productId, plan.id],
      );
      result.created.push(`Product ${productId} for plan "${plan.slug}"`);
    }

    const prices = await query<PriceRow>(
      `SELECT id, interval, amount_micros, currency, provider_price_id
         FROM billing_plan_prices
        WHERE plan_id = $1 AND effective_to IS NULL
        ORDER BY interval ASC`,
      [plan.id],
    );

    for (const price of prices) {
      const unitAmount = toUnitAmount(price.amount_micros);
      if (price.provider_price_id) {
        const mismatch = await verifyPrice(
          stripe,
          `plan "${plan.slug}" (${price.interval})`,
          price.provider_price_id,
          unitAmount,
          price.currency,
        );
        if (mismatch) {
          result.mismatches.push(mismatch);
        }
        continue;
      }
      const stripePrice = await stripe.prices.create({
        product: productId,
        currency: price.currency.toLowerCase(),
        unit_amount: unitAmount,
        recurring: { interval: price.interval === 'annual' ? 'year' : 'month' },
        metadata: { plan_id: plan.id, price_id: price.id },
      });
      await query(
        `UPDATE billing_plan_prices SET provider_price_id = $1, updated_at = NOW() WHERE id = $2`,
        [stripePrice.id, price.id],
      );
      result.created.push(
        `Price ${stripePrice.id} (${price.interval}, ${unitAmount} ${price.currency}) for plan "${plan.slug}"`,
      );
    }
  }

  // Quota top-up packs: ONE-TIME prices (no `recurring`), which is what makes
  // them usable with a `mode: 'payment'` checkout.
  const addons = await query<AddonRow>(
    `SELECT id, slug, limit_key, quantity, amount_micros, currency, provider_price_id
       FROM billing_quota_addons WHERE is_active = TRUE ORDER BY display_order ASC`,
  );

  for (const addon of addons) {
    const unitAmount = toUnitAmount(addon.amount_micros);
    if (addon.provider_price_id) {
      const mismatch = await verifyPrice(
        stripe,
        `top-up "${addon.slug}"`,
        addon.provider_price_id,
        unitAmount,
        addon.currency,
      );
      if (mismatch) {
        result.mismatches.push(mismatch);
      }
      continue;
    }
    const product = await stripe.products.create({
      name: `${addon.quantity} extra tracking conversions`,
      description: `One-time top-up: ${addon.quantity} additional tracking conversions for the current month.`,
      tax_code: SAAS_TAX_CODE,
      metadata: { addon_id: addon.id, addon_slug: addon.slug, limit_key: addon.limit_key },
    });
    const stripePrice = await stripe.prices.create({
      product: product.id,
      currency: addon.currency.toLowerCase(),
      unit_amount: unitAmount,
      metadata: { addon_id: addon.id, addon_slug: addon.slug },
    });
    await query(
      `UPDATE billing_quota_addons SET provider_price_id = $1, updated_at = NOW() WHERE id = $2`,
      [stripePrice.id, addon.id],
    );
    result.created.push(`Price ${stripePrice.id} (${unitAmount} ${addon.currency}) for top-up "${addon.slug}"`);
  }

  return result;
}
