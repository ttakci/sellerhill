// apps/api/src/scripts/stripe-test-clock.ts
//
// Developer tool that walks ONE throwaway subscription through renewal, a
// failed payment and cancellation on a Stripe TEST CLOCK, so the billing
// pipeline (webhook -> applier -> quota window -> suspension) can be watched
// end to end without waiting a month.
//
//   pnpm --filter api run stripe:test-clock -- setup --plan lite
//   pnpm --filter api run stripe:test-clock -- status  --clock clock_...
//   pnpm --filter api run stripe:test-clock -- advance --clock clock_... --days 31
//   pnpm --filter api run stripe:test-clock -- fail-card --clock clock_...
//   pnpm --filter api run stripe:test-clock -- cancel  --clock clock_...
//   pnpm --filter api run stripe:test-clock -- cleanup --clock clock_...
//
// WHY A SCRIPT
// A Test Clock has to be attached to a customer WHEN THE CUSTOMER IS CREATED,
// and the app's own checkout creates its customers without one — so the real
// sign-up path can never be time-travelled. This tool builds the same rows the
// real flow does (a local user, a billing_customers row linked to the Stripe
// customer, a subscription carrying `metadata.plan_id`) and then lets the
// running API's webhook endpoint do all the actual work, which is the part
// being rehearsed.
//
// SAFETY
//   * Refuses any Stripe key that is not `sk_test_...`. A clock cannot exist in
//     live mode, and this tool must never be able to touch a real customer.
//   * Creates its own throwaway user (`rehearsal-<ts>@sellerhill.test`) instead
//     of borrowing a real account, and `cleanup` removes it and everything
//     hanging off it.
//   * Needs the API running and `stripe listen --forward-to
//     localhost:3000/api/v1/billing/webhooks/stripe` forwarding events, or the
//     app never hears about anything this tool does.

import 'reflect-metadata';

import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import Stripe from 'stripe';

import { DatabaseService } from '../common/database/database.service';
import { STRIPE_API_VERSION } from '../modules/billing/billing-provider';
import { BillingRepositoryService } from '../modules/billing/billing-repository.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: pnpm --filter api run stripe:test-clock -- <command> [options]',
  '',
  '  setup     --plan <slug>            create user + clock + customer + subscription',
  '  status    --clock <id>             Stripe state next to the local rows',
  '  advance   --clock <id> --days <n>  move the clock forward (default 31)',
  '  fail-card --clock <id>             swap in a card that fails on the next charge',
  '  cancel    --clock <id>             cancel the subscription immediately',
  '  cleanup   --clock <id>             delete the clock, customer and throwaway user',
].join('\n');

const DAY_SECONDS = 86_400;
const CLOCK_READY_TIMEOUT_MS = 90_000;
const CLOCK_POLL_MS = 2_000;
// Stripe's documented test payment methods. The second attaches fine and then
// declines the first charge, which is exactly the "card went bad" case.
const PM_VISA = 'pm_card_visa';
const PM_CHARGE_FAILS = 'pm_card_chargeCustomerFail';

function log(message: string): void {
  console.warn(message);
}

function fail(message: string): number {
  console.error(message);
  return 1;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ParsedArgs {
  command: string;
  options: Map<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  // pnpm forwards a literal `--` separator to the script; it is not an argument.
  const [command = '', ...rest] = argv.filter((token, index) => !(index === 0 && token === '--'));
  const options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith('--')) {
      options.set(token.slice(2), rest[i + 1] ?? '');
      i += 1;
    }
  }
  return { command, options };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface Context {
  stripe: Stripe;
  database: DatabaseService;
  repository: BillingRepositoryService;
}

async function waitUntilReady(stripe: Stripe, clockId: string): Promise<Stripe.TestHelpers.TestClock> {
  const deadline = Date.now() + CLOCK_READY_TIMEOUT_MS;
  for (;;) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === 'ready') {
      return clock;
    }
    if (Date.now() > deadline) {
      throw new Error(`clock ${clockId} still "${clock.status}" after ${CLOCK_READY_TIMEOUT_MS / 1000}s`);
    }
    await delay(CLOCK_POLL_MS);
  }
}

async function customerForClock(stripe: Stripe, clockId: string): Promise<Stripe.Customer> {
  const page = await stripe.customers.list({ test_clock: clockId, limit: 1 });
  const customer = page.data[0];
  if (!customer) {
    throw new Error(`no customer is attached to ${clockId}`);
  }
  return customer;
}

async function setup(ctx: Context, planSlug: string): Promise<number> {
  const priceRows = await ctx.database.query<{
    plan_id: string;
    provider_price_id: string | null;
  }>(
    `SELECT p.id AS plan_id, pp.provider_price_id
       FROM billing_plans p
       JOIN billing_plan_prices pp ON pp.plan_id = p.id AND pp.effective_to IS NULL
      WHERE p.slug = $1`,
    [planSlug],
  );
  const plan = priceRows[0];
  if (!plan) {
    return fail(`unknown plan "${planSlug}"`);
  }
  if (!plan.provider_price_id) {
    return fail(
      `plan "${planSlug}" has no Stripe Price yet — run: pnpm --filter api run stripe:sync-catalog`,
    );
  }

  const stamp = Date.now();
  const email = `rehearsal-${stamp}@sellerhill.test`;
  const users = await ctx.database.query<{ id: string }>(
    `INSERT INTO users (first_name, last_name, email) VALUES ('Test', 'Clock', $1) RETURNING id`,
    [email],
  );
  const userId = users[0].id;
  await ctx.repository.ensureLocalCustomer(userId, email);

  const clock = await ctx.stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(stamp / 1000),
    name: `sellerhill rehearsal ${email}`,
  });
  const customer = await ctx.stripe.customers.create({
    email,
    test_clock: clock.id,
    metadata: { user_id: userId },
  });

  // Link BEFORE the subscription exists. Webhook order is not guaranteed, and a
  // customer.subscription.created that finds no local customer is dropped — the
  // same reason the real checkout links the customer first.
  await ctx.repository.linkProviderCustomer(userId, 'stripe', customer.id);

  // `pm_card_visa` is a test TOKEN, not a reusable id: attaching it mints a NEW
  // payment method, and that returned id is the one the customer must default to.
  const card = await ctx.stripe.paymentMethods.attach(PM_VISA, { customer: customer.id });
  await ctx.stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: card.id },
  });

  const subscription = await ctx.stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: plan.provider_price_id }],
    default_payment_method: card.id,
    metadata: { plan_id: plan.plan_id },
  });

  log(`user:          ${email} (${userId})`);
  log(`clock:         ${clock.id}`);
  log(`customer:      ${customer.id}`);
  log(`subscription:  ${subscription.id} (${subscription.status})`);
  log('');
  log('Next: pnpm --filter api run stripe:test-clock -- status --clock ' + clock.id);
  return 0;
}

async function status(ctx: Context, clockId: string): Promise<number> {
  const clock = await ctx.stripe.testHelpers.testClocks.retrieve(clockId);
  const customer = await customerForClock(ctx.stripe, clockId);
  const subs = await ctx.stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 5 });

  log(`clock ${clock.id}: ${clock.status}, frozen at ${new Date(clock.frozen_time * 1000).toISOString()}`);
  for (const sub of subs.data) {
    const item = sub.items.data[0];
    log(
      `stripe sub ${sub.id}: ${sub.status}` +
        (item
          ? `, period ${new Date(item.current_period_start * 1000).toISOString()} -> ${new Date(item.current_period_end * 1000).toISOString()}`
          : ''),
    );
  }

  const rows = await ctx.database.query<Record<string, unknown>>(
    `SELECT s.status, s.provider_subscription_id, s.current_period_start, s.current_period_end, p.slug AS plan
       FROM billing_customers c
       LEFT JOIN billing_subscriptions s ON s.customer_id = c.id
       LEFT JOIN billing_plans p ON p.id = s.plan_id
      WHERE c.provider_customer_id = $1
      ORDER BY s.created_at DESC`,
    [customer.id],
  );
  log('');
  log('local billing_subscriptions:');
  if (rows.length === 0) {
    log('  (none — the webhook has not landed yet, or is not being forwarded)');
  }
  for (const row of rows) {
    log('  ' + JSON.stringify(row));
  }

  const inbox = await ctx.database.query<{ event_type: string; status: string }>(
    `SELECT event_type, status FROM billing_webhook_inbox ORDER BY received_at DESC LIMIT 8`,
  );
  log('');
  log('last webhook inbox rows:');
  for (const row of inbox) {
    log(`  ${row.event_type}  ${row.status}`);
  }
  return 0;
}

async function advance(ctx: Context, clockId: string, days: number): Promise<number> {
  const clock = await ctx.stripe.testHelpers.testClocks.retrieve(clockId);
  const target = clock.frozen_time + days * DAY_SECONDS;
  await ctx.stripe.testHelpers.testClocks.advance(clockId, { frozen_time: target });
  log(`advancing ${clockId} by ${days} day(s) to ${new Date(target * 1000).toISOString()} ...`);
  await waitUntilReady(ctx.stripe, clockId);
  log('clock ready. Give the webhooks a few seconds, then run status.');
  return 0;
}

async function failCard(ctx: Context, clockId: string): Promise<number> {
  const customer = await customerForClock(ctx.stripe, clockId);
  const badCard = await ctx.stripe.paymentMethods.attach(PM_CHARGE_FAILS, { customer: customer.id });
  await ctx.stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: badCard.id },
  });
  const subs = await ctx.stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });
  if (subs.data[0]) {
    await ctx.stripe.subscriptions.update(subs.data[0].id, {
      default_payment_method: badCard.id,
    });
  }
  log('the customer now pays with a card that declines. Advance past the next renewal.');
  return 0;
}

async function cancel(ctx: Context, clockId: string): Promise<number> {
  const customer = await customerForClock(ctx.stripe, clockId);
  const subs = await ctx.stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });
  const sub = subs.data[0];
  if (!sub) {
    return fail('no subscription to cancel');
  }
  await ctx.stripe.subscriptions.cancel(sub.id);
  log(`cancelled ${sub.id}. Run status to watch the account resolve to suspended.`);
  return 0;
}

async function cleanup(ctx: Context, clockId: string): Promise<number> {
  const customer = await customerForClock(ctx.stripe, clockId).catch(() => null);
  const userId = customer?.metadata?.user_id;

  // Deleting the clock deletes its customers and subscriptions in Stripe.
  await ctx.stripe.testHelpers.testClocks.del(clockId);

  if (userId) {
    // billing_customers is ON DELETE SET NULL from users, so it goes first; it
    // cascades on to subscriptions, usage periods and reservations.
    await ctx.database.query('DELETE FROM billing_customers WHERE user_id = $1', [userId]);
    await ctx.database.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  log(`deleted clock ${clockId}${userId ? ` and throwaway user ${userId}` : ''}.`);
  return 0;
}

async function run(): Promise<number> {
  const { command, options } = parseArgs(process.argv.slice(2));

  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key.startsWith('sk_test_')) {
    return fail(
      'STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Test Clocks do not exist in live mode, and this tool must never be able to reach a real customer.',
    );
  }
  if (!process.env.DATABASE_URL) {
    return fail('DATABASE_URL not set');
  }

  const database = new DatabaseService(new ConfigService());
  const ctx: Context = {
    stripe: new Stripe(key, { apiVersion: STRIPE_API_VERSION }),
    database,
    repository: new BillingRepositoryService(database),
  };

  const clockId = options.get('clock') ?? '';
  try {
    switch (command) {
      case 'setup':
        return await setup(ctx, options.get('plan') ?? 'lite');
      case 'status':
        return clockId ? await status(ctx, clockId) : fail(`--clock is required\n${USAGE}`);
      case 'advance':
        return clockId
          ? await advance(ctx, clockId, Number(options.get('days') ?? '31'))
          : fail(`--clock is required\n${USAGE}`);
      case 'fail-card':
        return clockId ? await failCard(ctx, clockId) : fail(`--clock is required\n${USAGE}`);
      case 'cancel':
        return clockId ? await cancel(ctx, clockId) : fail(`--clock is required\n${USAGE}`);
      case 'cleanup':
        return clockId ? await cleanup(ctx, clockId) : fail(`--clock is required\n${USAGE}`);
      default:
        return fail(USAGE);
    }
  } catch (error: unknown) {
    return fail(`failed: ${describeError(error)}`);
  } finally {
    await database.closeAll();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(describeError(error));
    process.exit(1);
  });
