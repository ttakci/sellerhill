// apps/api/src/scripts/billing-reconcile.ts
//
// Operator-only CLI that re-reads a customer's live subscription straight from
// Stripe and re-applies it to `billing_subscriptions`. There is NO HTTP path.
//
//   pnpm --filter api run billing:reconcile -- --email a@b.c
//   pnpm --filter api run billing:reconcile -- --email a@b.c --dry-run
//
// WHY THIS EXISTS
//
// Tasks 1-5 made a quota window follow the Stripe billing period, and made a
// window that has gone stale past a 6-hour grace resolve to SUSPENDED at read
// time — because the absence of a `customer.subscription.updated` webhook is
// not evidence that the account is paid up. That rule creates an obligation:
// if webhook silence can suspend an account, the recovery path must NOT itself
// depend on a webhook, or the failure mode is self-locking. This CLI is that
// path — it asks Stripe directly and writes the answer through the same
// applier the webhook uses.
//
// CONTRACT
//   1. There is exactly ONE writer of `billing_subscriptions` — the repository.
//      This script calls `BillingRepositoryService.upsertSubscriptionByProvider`
//      and maps the Stripe object with the SAME exported pure function the
//      webhook applier uses (`extractStripeSubscriptionFields`). It never writes
//      that row with its own SQL. Two writers of that row is the drift this
//      module has repeatedly suffered.
//   2. It does NOT re-enqueue anything. Auto-fulfill resume is a lazy sweep in
//      `OrderSyncService.syncOrdersForAccount` that runs on the next order-sync
//      tick once the account is entitled again (~20 min). This CLI only reports
//      that.
//   3. No NestJS application context is bootstrapped: `DatabaseService` +
//      `BillingRepositoryService` are constructed directly, so no BullMQ
//      processor, scheduler, or boot-time migration run starts as a side effect.
//      `DatabaseService.onModuleInit` (test-connection + migrations) is a Nest
//      lifecycle hook and is never called here.
//
// Exit codes (matching reset-users.ts):
//   0 — reconciled, or dry run completed
//   2 — bad arguments
//   3 — --email given but no such user
//   1 — refused (no Stripe key / no linked customer / nothing to reconcile) or
//       any Stripe/DB failure

import 'reflect-metadata';

import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';

import { DatabaseService } from '../common/database/database.service';
import { BillingRepositoryService } from '../modules/billing/billing-repository.service';
import { extractStripeSubscriptionFields } from '../modules/billing/stripe-event-applier';

import {
  buildReconcileEvent,
  parseReconcileArgs,
  ReconcileArgError,
  resolveReconcilePlanId,
  type ReconcileArgs,
} from './billing-reconcile-helpers';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: pnpm --filter api run billing:reconcile -- --email <email> [--dry-run]',
  '',
  'Re-reads the user\'s live subscription from Stripe and re-applies it to',
  'billing_subscriptions through the same mapper the webhook uses. Recovery for a',
  'lost customer.subscription.* webhook — it does not depend on a webhook itself.',
  '',
  '  --email <email>  The account to reconcile (matched on LOWER(email))',
  '  --dry-run        Print what would be written and exit without writing',
].join('\n');

// Statuses that mean "this customer is currently subscribed", mirroring
// StripeBillingProvider.LIVE_SUBSCRIPTION_STATUSES. When more than one
// subscription exists Stripe returns them newest-first, so the first match is
// the current one.
const LIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
]);

function log(msg: string): void {
  console.warn(msg);
}

function logError(msg: string): void {
  console.error(msg);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function orDash(value: string | null): string {
  return value ?? '—';
}

async function run(): Promise<number> {
  let args: ReconcileArgs;
  try {
    args = parseReconcileArgs(process.argv.slice(2));
  } catch (error: unknown) {
    if (error instanceof ReconcileArgError) {
      logError(`${error.message}\n${USAGE}`);
      return 2;
    }
    throw error;
  }

  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL not set');
    return 1;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    logError(
      'STRIPE_SECRET_KEY not set. This CLI reads the live subscription from Stripe, so it cannot run without it.',
    );
    return 1;
  }

  // Constructed directly — no Nest context, so onModuleInit (test-connection +
  // migrations) never fires and no queue/scheduler starts. ConfigService with
  // no internal config reads straight from process.env.
  const database = new DatabaseService(new ConfigService());
  const repository = new BillingRepositoryService(database);
  // Same construction as StripeBillingProvider.getClient (no apiVersion pin).
  const stripe = new Stripe(stripeSecretKey);

  try {
    const userRows = await database.query<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [args.email],
    );
    const userId = userRows[0]?.id;
    if (!userId) {
      logError(`user not found: ${args.email}`);
      return 3;
    }

    const customerRows = await database.query<{
      id: string;
      provider: string;
      provider_customer_id: string | null;
    }>(
      'SELECT id, provider, provider_customer_id FROM billing_customers WHERE user_id = $1',
      [userId],
    );
    const customer = customerRows[0];
    if (!customer || !customer.provider_customer_id) {
      logError(
        `no Stripe customer linked for ${args.email} — the account has never completed checkout, so there is nothing to reconcile.`,
      );
      return 1;
    }
    const providerCustomerId = customer.provider_customer_id;

    log(`user:            ${args.email} (${userId})`);
    log(`stripe customer: ${providerCustomerId}`);
    log('');

    const page = await stripe.subscriptions.list({
      customer: providerCustomerId,
      status: 'all',
      limit: 100,
    });
    if (page.data.length === 0) {
      logError(
        'Stripe has no subscription for this customer. Nothing to reconcile — if the account should be suspended, that is already the correct state.',
      );
      return 1;
    }

    const live = page.data.find((sub) => LIVE_SUBSCRIPTION_STATUSES.has(sub.status));
    const target = live ?? page.data[0];
    if (!live) {
      log(
        `note: no live subscription found; reconciling the most recent one (${target.id}, status "${target.status}").`,
      );
    }

    const fields = extractStripeSubscriptionFields(buildReconcileEvent(target));
    if (!fields) {
      logError(
        `Stripe reports subscription ${target.id} with status "${target.status}", which this system does not track. Nothing to re-apply.`,
      );
      return 1;
    }

    const planId = resolveReconcilePlanId(target);
    if (!planId) {
      logError(
        `subscription ${target.id} carries no plan_id in its Stripe metadata — it was created outside our checkout flow and cannot be mapped to a local plan.`,
      );
      return 1;
    }

    const plan = await repository.findPlanById(planId);
    if (!plan) {
      logError(
        `plan_id "${planId}" from the subscription's Stripe metadata does not match any billing_plans row.`,
      );
      return 1;
    }

    const summary = [
      `subscription:    ${fields.providerSubscriptionId}`,
      `stripe status:   ${target.status}  ->  ${fields.status}`,
      `plan:            ${plan.slug} (${planId})`,
      `interval:        ${fields.interval}`,
      `current period:  ${fields.currentPeriodStart.toISOString()} .. ${fields.currentPeriodEnd.toISOString()}`,
      `canceledAt:      ${orDash(fields.canceledAt ? fields.canceledAt.toISOString() : null)}`,
      `endedAt:         ${orDash(fields.endedAt ? fields.endedAt.toISOString() : null)}`,
    ];

    if (args.dryRun) {
      log('would write to billing_subscriptions:');
      for (const line of summary) {
        log(`  ${line}`);
      }
      log('');
      log('would also close any local trial rows for this user (provider_subscription_id IS NULL).');
      log('');
      log('DRY RUN — nothing was written. Re-run without --dry-run to apply.');
      return 0;
    }

    // Write the subscription FIRST, then close any local trial rows.
    //
    // The reverse order (trial-close then upsert, which the webhook applier
    // uses) has a failure mode this recovery tool must not have: if the
    // trial-close succeeds and the upsert then throws, the local trial row is
    // ENDED and no subscription row exists — findCurrentSubscription returns
    // the ended trial and the account reads SUSPENDED. The tool whose whole
    // job is to UN-suspend an account would have left it suspended, with no
    // Stripe redelivery to retry.
    //
    // Doing the upsert first needs no transaction: findCurrentSubscription's
    // `ORDER BY (provider_subscription_id IS NULL) ASC` ranks the freshly
    // written provider-backed row ABOVE an un-closed trial, so the
    // intermediate state (subscription written, trial not yet closed) already
    // resolves correctly.
    //
    // `allowPeriodRewind = true`: this CLI exists partly to repair a row whose
    // current_period_start was stamped with webhook-receipt time by the
    // now()/+30d fallback, so it must be able to write Stripe's real, EARLIER
    // start — the one place that bypass is correct. See
    // upsertSubscriptionByProvider's own doc.
    const updated = await repository.upsertSubscriptionByProvider(
      customer.id,
      planId,
      fields,
      true,
    );
    if (!updated) {
      logError('upsertSubscriptionByProvider returned no row — the write did not land.');
      return 1;
    }

    // Now that the provider-backed row exists, retire any local trial rows so
    // they cannot linger. Best-effort — a failure here must not abort the
    // reconcile, and the ORDER BY above already keeps the result correct.
    try {
      await repository.endTrialSubscriptionsForUser(userId);
    } catch (error: unknown) {
      logError(`warning: could not close local trial rows for ${args.email}: ${describeError(error)}`);
    }

    log('reconciled billing_subscriptions:');
    for (const line of summary) {
      log(`  ${line}`);
    }
    log('');
    log(
      'Auto-fulfill resumes on the next order-sync tick (within ~20 minutes) once the\n' +
        'account is entitled again — this CLI does not re-enqueue anything itself.',
    );
    return 0;
  } catch (error: unknown) {
    logError(`reconcile failed: ${describeError(error)}`);
    return 1;
  } finally {
    await database.closeAll();
  }
}

void run().then((code) => {
  process.exit(code);
});
