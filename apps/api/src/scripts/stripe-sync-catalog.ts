// apps/api/src/scripts/stripe-sync-catalog.ts
//
// Operator CLI: mirror the billing catalog into Stripe NOW, and verify what is
// already mirrored.
//
//   pnpm --filter api stripe:sync-catalog
//
// This is no longer a required step. The automatic price-migration job
// (`billing-price-migration`, hourly) runs the same `syncStripeCatalog` first,
// so a price change shipped by migration reaches Stripe on its own. The CLI
// stays for the moments an operator wants the answer immediately — right after
// switching to live keys, or to see a mismatch report on the terminal.
//
// Exits non-zero on a price mismatch so a deploy step running it fails instead
// of reporting success while customers are charged the wrong amount.

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import Stripe from 'stripe';

import { STRIPE_API_VERSION } from '../modules/billing/billing-provider';
import { syncStripeCatalog, type CatalogQuery } from '../modules/billing/stripe-catalog-sync';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string): void {
  console.warn(msg);
}

function logError(msg: string): void {
  console.error(msg);
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

  const stripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
  const pool = new Pool({ connectionString: databaseUrl });
  const query: CatalogQuery = async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) =>
    (await pool.query<T>(sql, params)).rows;

  try {
    const { created, mismatches } = await syncStripeCatalog(query, stripe);
    for (const line of created) {
      log(`Created ${line}`);
    }
    if (created.length === 0) {
      log('Nothing to create — every active plan price and top-up is already in Stripe.');
    }

    if (mismatches.length > 0) {
      logError('');
      logError('PRICE MISMATCH — the app and Stripe disagree about what these cost:');
      for (const line of mismatches) {
        logError(`  ${line}`);
      }
      logError('');
      logError(
        'A Stripe Price cannot be edited. Close the local price row (effective_to) and insert ' +
          'a new one with no provider_price_id; it is then mirrored automatically.',
      );
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
