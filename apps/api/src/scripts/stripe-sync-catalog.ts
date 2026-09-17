// apps/api/src/scripts/stripe-sync-catalog.ts
//
// One-off, idempotent CLI that mirrors the existing billing_plans /
// billing_plan_prices catalog (Starter/Growth/Scale) into real Stripe
// Products/Prices, writing the returned ids back onto the DB rows. Without
// this, `billing_plans.provider_product_id` / `billing_plan_prices.provider_price_id`
// stay NULL and StripeBillingProvider.createCheckout throws
// 'billing.errors.planNotMirrored' for every plan.
//
// Run it with:
//   pnpm --filter api run stripe:sync-catalog
//
// Safe to re-run: a plan/price that already has a provider id is left alone
// (Stripe Prices are immutable once created — amount/interval changes always
// need a new Price row, matching the existing effective-dated pricing model,
// so there is nothing to "update" on an already-synced price). Does NOT
// bootstrap the NestJS app context — same direct-`pg`-Pool convention as
// migrate.ts / user-set-role.ts.
//
// Tax code: each Product is created with tax_code = 'txcd_10103001' (Software
// as a Service — Business Use, per Stripe's own guidance for SaaS; the too-
// broad default 'txcd_10000000' is deliberately NOT used — see CLAUDE.md's
// Stripe Tax section). automatic_tax still collects ZERO tax until a head
// office address and at least one active registration are set in the Stripe
// Dashboard — this script does not (and cannot) do that for you.

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SAAS_TAX_CODE = 'txcd_10103001';

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider_product_id: string | null;
}

interface PriceRow {
  id: string;
  plan_id: string;
  interval: 'monthly' | 'annual';
  amount_micros: string;
  currency: string;
  provider_price_id: string | null;
}

function log(msg: string): void {
  console.warn(msg);
}

function logError(msg: string): void {
  console.error(msg);
}

interface AddonRow {
  id: string;
  slug: string;
  limit_key: string;
  quantity: string;
  amount_micros: string;
  currency: string;
  provider_price_id: string | null;
}

/**
 * Compare one already-mirrored price against Stripe and describe any
 * divergence. Returns [] when they agree (or when the Price cannot be read —
 * an unreadable answer is reported, never treated as agreement).
 *
 * A Stripe Price is IMMUTABLE. So a changed amount in `billing_plan_prices`
 * can only be shipped as a NEW price row plus a new Stripe Price; editing the
 * figure in place leaves the app advertising one price while Stripe charges
 * the old one, with nothing anywhere to notice.
 */
async function collectPriceMismatch(
  stripe: Stripe,
  args: {
    label: string;
    providerPriceId: string;
    expectedUnitAmount: number;
    expectedCurrency: string;
    log: (message: string) => void;
  },
): Promise<string[]> {
  try {
    const remote = await stripe.prices.retrieve(args.providerPriceId);
    const sameAmount = remote.unit_amount === args.expectedUnitAmount;
    const sameCurrency = remote.currency === args.expectedCurrency.toLowerCase();
    if (sameAmount && sameCurrency) {
      args.log(`  ${args.label}: Stripe Price ${args.providerPriceId} matches (${args.expectedUnitAmount} ${args.expectedCurrency}).`);
      return [];
    }
    return [
      `${args.label}: local ${args.expectedUnitAmount} ${args.expectedCurrency.toUpperCase()} ` +
        `vs Stripe ${String(remote.unit_amount)} ${remote.currency.toUpperCase()} (${args.providerPriceId})`,
    ];
  } catch (error: unknown) {
    return [
      `${args.label}: could not read Stripe Price ${args.providerPriceId} — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    ];
  }
}

async function run(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError('DATABASE_URL not set');
    return 1;
  }
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    logError('STRIPE_SECRET_KEY not set — nothing to sync to');
    return 1;
  }

  const stripe = new Stripe(stripeSecretKey);
  // Every already-mirrored row whose Stripe Price no longer matches the local
  // catalog. Collected rather than thrown on, so ONE run reports every
  // divergence instead of stopping at the first.
  const mismatches: string[] = [];
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const { rows: plans } = await pool.query<PlanRow>(
      `SELECT id, slug, name, description, provider_product_id FROM billing_plans WHERE is_active = TRUE ORDER BY display_order ASC`,
    );
    if (plans.length === 0) {
      log('No active billing_plans rows found — nothing to sync.');
      return 0;
    }

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
        await pool.query(`UPDATE billing_plans SET provider_product_id = $1, updated_at = NOW() WHERE id = $2`, [
          productId,
          plan.id,
        ]);
        log(`Created Stripe Product ${productId} for plan "${plan.slug}"`);
      } else {
        log(`Plan "${plan.slug}" already has Stripe Product ${productId} — skipping product create.`);
      }

      const { rows: prices } = await pool.query<PriceRow>(
        `SELECT id, plan_id, interval, amount_micros, currency, provider_price_id
         FROM billing_plan_prices
         WHERE plan_id = $1 AND effective_to IS NULL
         ORDER BY interval ASC`,
        [plan.id],
      );

      for (const price of prices) {
        if (price.provider_price_id) {
          // Already mirrored — but VERIFY the amount instead of taking the
          // presence of an id as proof. A Stripe Price is immutable, so editing
          // `billing_plan_prices.amount_micros` without minting a new one makes
          // the app advertise one figure while Stripe charges another, silently
          // and forever. Nothing else in the system compares the two.
          mismatches.push(
            ...(await collectPriceMismatch(stripe, {
              label: `plan "${plan.slug}" (${price.interval})`,
              providerPriceId: price.provider_price_id,
              expectedUnitAmount: Math.round(Number(price.amount_micros) / 10_000),
              expectedCurrency: price.currency,
              log,
            })),
          );
          continue;
        }
        // amount_micros is 1/1,000,000 of the major unit; Stripe unit_amount
        // is the smallest currency unit (cents for USD) as an integer.
        const unitAmount = Math.round(Number(price.amount_micros) / 10_000);
        const stripePrice = await stripe.prices.create({
          product: productId,
          currency: price.currency.toLowerCase(),
          unit_amount: unitAmount,
          recurring: { interval: price.interval === 'annual' ? 'year' : 'month' },
          metadata: { plan_id: plan.id, price_id: price.id },
        });
        await pool.query(
          `UPDATE billing_plan_prices SET provider_price_id = $1, updated_at = NOW() WHERE id = $2`,
          [stripePrice.id, price.id],
        );
        log(`  Created Stripe Price ${stripePrice.id} (${price.interval}, ${unitAmount} ${price.currency}) for "${plan.slug}"`);
      }
    }

    // ---------------------------------------------------------------------
    // Quota top-up packs (migration 087).
    //
    // ONE-TIME prices: `prices.create` is called WITHOUT `recurring`, which is
    // what makes them usable with `mode: 'payment'`. Passing `recurring` here
    // would produce a subscription price that a one-time checkout refuses.
    //
    // Same idempotency rule as the plan loop: a pack that already carries a
    // provider_price_id is skipped, because a Stripe Price is immutable once
    // created — changing what a pack costs means a new row, not an edit.
    // ---------------------------------------------------------------------
    const { rows: addons } = await pool.query<AddonRow>(
      `SELECT id, slug, limit_key, quantity, amount_micros, currency, provider_price_id
         FROM billing_quota_addons
        WHERE is_active = TRUE
        ORDER BY display_order ASC`,
    );

    for (const addon of addons) {
      if (addon.provider_price_id) {
        mismatches.push(
          ...(await collectPriceMismatch(stripe, {
            label: `top-up "${addon.slug}"`,
            providerPriceId: addon.provider_price_id,
            expectedUnitAmount: Math.round(Number(addon.amount_micros) / 10_000),
            expectedCurrency: addon.currency,
            log,
          })),
        );
        continue;
      }
      const product = await stripe.products.create({
        name: `${addon.quantity} extra tracking conversions`,
        description: `One-time top-up: ${addon.quantity} additional tracking conversions for the current month.`,
        tax_code: SAAS_TAX_CODE,
        metadata: { addon_id: addon.id, addon_slug: addon.slug, limit_key: addon.limit_key },
      });
      const unitAmount = Math.round(Number(addon.amount_micros) / 10_000);
      const stripePrice = await stripe.prices.create({
        product: product.id,
        currency: addon.currency.toLowerCase(),
        unit_amount: unitAmount,
        metadata: { addon_id: addon.id, addon_slug: addon.slug },
      });
      await pool.query(
        `UPDATE billing_quota_addons SET provider_price_id = $1, updated_at = NOW() WHERE id = $2`,
        [stripePrice.id, addon.id],
      );
      log(`Created Stripe Price ${stripePrice.id} (${unitAmount} ${addon.currency}) for top-up "${addon.slug}"`);
    }

    if (mismatches.length > 0) {
      logError('');
      logError('PRICE MISMATCH — the app and Stripe disagree about what these cost:');
      for (const line of mismatches) {
        logError(`  ${line}`);
      }
      logError('');
      logError(
        'A Stripe Price cannot be edited. Fix this by closing the local price row ' +
          '(effective_to) and inserting a new one with no provider_price_id, then re-running this script.',
      );
      // Non-zero: a CI/deploy step running this must fail rather than report
      // a successful sync while customers are charged the wrong amount.
      return 1;
    }

    log('Stripe catalog sync complete.');
    return 0;
  } catch (error: unknown) {
    logError(`Stripe catalog sync failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

void run().then((code) => {
  process.exit(code);
});
