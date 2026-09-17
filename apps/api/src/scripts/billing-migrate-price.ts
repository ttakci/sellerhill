// apps/api/src/scripts/billing-migrate-price.ts
//
// Operator-only CLI: move a plan's EXISTING subscribers onto its current price,
// from each subscriber's next renewal. There is NO HTTP path.
//
//   pnpm --filter api billing:migrate-price -- --plan growth            # dry run
//   pnpm --filter api billing:migrate-price -- --plan growth --apply    # do it
//
// WHEN TO RUN IT
//
// Changing a plan's price is: close the old `billing_plan_prices` row, insert
// the new one, run `stripe:sync-catalog`. From then on NEW subscribers pay the
// new price — but every existing subscriber stays on the old Stripe Price for
// ever, because a Stripe Price is immutable and Stripe never moves anyone on
// its own. That is the "keep them on the old price" option, and it needs
// nothing. This script is the other option.
//
// WHAT IT DOES, PER SUBSCRIBER
//
//   1. Reads the live subscription from Stripe (never trusts local state for
//      what someone is actually billed).
//   2. Decides via `decidePriceMigration` — already on the new price, cancelling,
//      or carrying a change they scheduled themselves are all left alone.
//   3. Schedules the new price from the END of the current period, using the
//      same Subscription Schedule operation a downgrade uses. The period the
//      seller is in finishes at the price they already paid; the next one
//      starts at the new price. Nothing is charged or refunded today.
//   4. Only once Stripe has accepted the schedule, e-mails the seller the old
//      price, the new price and the date. An e-mail is never sent for a change
//      that did not happen.
//
// DRY RUN BY DEFAULT. Without --apply it prints what it would do and touches
// nothing — this moves real customers' prices, so the safe mode is the default.
//
// Re-runnable: subscribers already moved report `already_on_target`, and those
// skipped for a pending change are picked up by a later run once it lands.
//
// Exit codes: 0 done/dry run, 2 bad args, 3 no such plan, 1 refused or failure.

import 'reflect-metadata';

import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import { PlanChangeDirection } from '@repo/shared';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';

import { DatabaseService } from '../common/database/database.service';
import { PlatformSettingsService } from '../common/settings/platform-settings.service';
import { resolveBillingConfig } from '../modules/billing/billing-helpers';
import { STRIPE_API_VERSION, StripeBillingProvider } from '../modules/billing/billing-provider';
import { BillingRepositoryService } from '../modules/billing/billing-repository.service';
import {
  decidePriceMigration,
  formatStripeAmount,
  PriceMigrationAction,
} from '../modules/billing/price-migration';
import { EmailService } from '../modules/email/email.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: pnpm --filter api billing:migrate-price -- --plan <slug> [--apply]',
  '',
  '  --plan <slug>  the plan whose existing subscribers move to its current price',
  '  --apply        actually schedule the change and e-mail subscribers',
  '                 (without it: dry run, nothing is written or sent)',
].join('\n');

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logError(message: string): void {
  process.stderr.write(`${message}\n`);
}

class ArgError extends Error {}

function parseArgs(argv: string[]): { plan: string; apply: boolean } {
  let plan: string | null = null;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--plan') {
      plan = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--apply') {
      apply = true;
    } else {
      throw new ArgError(`Unknown argument: ${arg}`);
    }
  }
  if (!plan || !/^[a-z0-9-]{1,64}$/.test(plan)) {
    throw new ArgError('--plan <slug> is required');
  }
  return { plan, apply };
}

async function run(): Promise<number> {
  let args: { plan: string; apply: boolean };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    if (error instanceof ArgError) {
      logError(`${error.message}\n${USAGE}`);
      return 2;
    }
    throw error;
  }

  if (!process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY) {
    logError('DATABASE_URL and STRIPE_SECRET_KEY must both be set.');
    return 1;
  }

  // No Nest context, same as the other billing CLIs: no processor, scheduler
  // or boot-time migration run starts as a side effect.
  const config = new ConfigService();
  const database = new DatabaseService(config);
  const repository = new BillingRepositoryService(database);
  const provider = new StripeBillingProvider(resolveBillingConfig(), repository);
  const email = new EmailService(config, database, new PlatformSettingsService(database, config));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

  try {
    const plans = await database.query<{ id: string; slug: string; name: string }>(
      `SELECT id, slug, name FROM billing_plans WHERE slug = $1`,
      [args.plan],
    );
    const plan = plans[0];
    if (!plan) {
      logError(`No plan with slug "${args.plan}".`);
      return 3;
    }

    const prices = await database.query<{ provider_price_id: string | null }>(
      `SELECT provider_price_id FROM billing_plan_prices
        WHERE plan_id = $1 AND interval = 'monthly' AND effective_to IS NULL
        ORDER BY effective_from DESC
        LIMIT 1`,
      [plan.id],
    );
    const targetPriceId = prices[0]?.provider_price_id ?? null;
    if (!targetPriceId) {
      logError(
        `Plan "${plan.slug}" has no current Stripe price. Run \`pnpm --filter api stripe:sync-catalog\` first.`,
      );
      return 1;
    }
    const target = await stripe.prices.retrieve(targetPriceId);

    const subscribers = await database.query<{
      provider_subscription_id: string;
      user_id: string;
      email: string;
      first_name: string | null;
      locale: string | null;
    }>(
      `SELECT s.provider_subscription_id, u.id AS user_id, u.email, u.first_name, u.locale
         FROM billing_subscriptions s
         JOIN billing_customers c ON c.id = s.customer_id
         JOIN users u ON u.id = c.user_id
        WHERE s.plan_id = $1
          AND s.provider_subscription_id IS NOT NULL
          AND s.status IN ('active', 'past_due', 'trialing')
        ORDER BY s.current_period_end ASC`,
      [plan.id],
    );

    log(
      `${args.apply ? 'APPLY' : 'DRY RUN'} — plan "${plan.slug}", target ${formatStripeAmount(
        target.unit_amount,
        target.currency,
        'en',
      )} (${targetPriceId}), ${subscribers.length} subscriber(s).`,
    );

    const counts = new Map<string, number>();
    let failures = 0;
    for (const sub of subscribers) {
      const locale = sub.locale === 'tr' ? 'tr' : 'en';
      try {
        const live = await stripe.subscriptions.retrieve(sub.provider_subscription_id);
        const item = live.items.data[0];
        const action = decidePriceMigration({
          status: live.status,
          currentPriceId: item?.price?.id ?? null,
          targetPriceId,
          hasSchedule: Boolean(live.schedule),
          cancelAtPeriodEnd: live.cancel_at_period_end,
        });
        counts.set(action, (counts.get(action) ?? 0) + 1);

        const periodEnd = item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null;
        const effectiveDate = periodEnd
          ? periodEnd.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : '—';
        const oldPrice = formatStripeAmount(
          item?.price?.unit_amount ?? null,
          item?.price?.currency ?? target.currency,
          locale,
        );
        const newPrice = formatStripeAmount(target.unit_amount, target.currency, locale);

        log(
          `  ${sub.provider_subscription_id}  ${action}  ${oldPrice} -> ${newPrice}  from ${effectiveDate}`,
        );
        if (action !== PriceMigrationAction.MIGRATE || !args.apply) {
          continue;
        }

        // Stripe first. The e-mail is only ever about a change that exists.
        // `scheduleDowngrade` is the generic "new price from the end of the
        // current period" operation — the name reflects its first caller, not a
        // restriction. `direction` only labels the change for Stripe's logs.
        await provider.scheduleDowngrade({
          providerSubscriptionId: sub.provider_subscription_id,
          providerPriceId: targetPriceId,
          planId: plan.id,
          direction:
            (target.unit_amount ?? 0) >= (item?.price?.unit_amount ?? 0)
              ? PlanChangeDirection.UPGRADE
              : PlanChangeDirection.DOWNGRADE,
        });

        try {
          await email.sendPriceChangeEmail(
            sub.email,
            sub.first_name ?? '',
            { planName: plan.name, oldPrice, newPrice, effectiveDate },
            locale,
          );
        } catch (mailError: unknown) {
          // The price change IS scheduled; only the notice failed. Reported
          // loudly so the operator can notify this seller by hand — a price
          // change without notice is the one outcome to avoid.
          failures += 1;
          logError(
            `    scheduled, but the notice e-mail FAILED for user ${sub.user_id}: ${
              mailError instanceof Error ? mailError.message : String(mailError)
            } — notify this seller manually.`,
          );
        }
      } catch (error: unknown) {
        failures += 1;
        logError(
          `  ${sub.provider_subscription_id}  FAILED: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    log('');
    for (const [action, count] of counts) {
      log(`  ${action}: ${count}`);
    }
    if (!args.apply) {
      log('');
      log('DRY RUN — nothing was scheduled and no e-mail was sent. Re-run with --apply to do it.');
    }
    return failures > 0 ? 1 : 0;
  } finally {
    await database.closeAll();
  }
}

void run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    logError(`billing:migrate-price failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
