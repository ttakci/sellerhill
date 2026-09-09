// apps/api/src/scripts/reset-users.ts
//
// Operator-only CLI that wipes user accounts from a NON-PRODUCTION database so
// the signup -> trial -> onboarding flow can be exercised from scratch. There
// is no HTTP path and there never should be.
//
//   pnpm --filter api run reset-users                      # dry run (default)
//   pnpm --filter api run reset-users -- --yes             # delete every user
//   pnpm --filter api run reset-users -- --email a@b.c --yes
//   pnpm --filter api run reset-users -- --yes --products  # also clear the ASIN cache
//
// Safety contract:
//   1. Refuses outright when NODE_ENV=production.
//   2. The default run WRITES NOTHING — it prints the row counts that would be
//      destroyed and exits. `--yes` is required to delete.
//   3. Prints the database host/name first, so an operator can see which
//      database is about to be emptied before confirming.
//   4. One transaction: either the whole reset lands or none of it does.
//   5. The delete plan is a frozen list in `reset-users-helpers.ts`, asserted
//      against a protected-table list so catalog/config data (plans, templates,
//      platform_settings, learned eBay taxonomy) can never be caught up in it.
//
// Exit codes:
//   0 — reset applied, or dry run completed, or nothing to delete
//   2 — bad arguments
//   3 — --email given but no such user
//   1 — refused (production) or any DB/transaction failure

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool, type PoolClient } from 'pg';

import {
  assertResetPlanIsSafe,
  isLocalDatabaseUrl,
  parseResetUsersArgs,
  ResetUsersArgError,
  type ResetUsersArgs,
} from './reset-users-helpers';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: pnpm --filter api run reset-users -- [--email <email>] [--products] [--yes]',
  '',
  'Deletes user accounts and everything hanging off them so a fresh signup can',
  'be tested. Dry run by default — pass --yes to actually delete.',
  '',
  '  --email <email>  Delete only this user (default: every user)',
  '  --products       Also clear the shared products ASIN cache',
  '  --allow-remote   Permit a DATABASE_URL that is not on this machine',
  '  --yes            Actually perform the deletion',
].join('\n');

function log(msg: string): void {
  console.warn(msg);
}

function logError(msg: string): void {
  console.error(msg);
}

/** Host + database name only — never the credentials in DATABASE_URL. */
function describeDatabase(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function countRows(
  client: PoolClient,
  label: string,
  sql: string,
  params: unknown[],
): Promise<{ label: string; count: number }> {
  const { rows } = await client.query<{ cnt: string }>(sql, params);
  return { label, count: Number(rows[0]?.cnt ?? 0) };
}

/**
 * What the run would destroy. Cascade victims are counted for information only;
 * they are removed by `DELETE FROM users`, not by a statement of their own.
 */
async function collectCounts(
  client: PoolClient,
  userId: string | null,
  includeProducts: boolean,
): Promise<Array<{ label: string; count: number }>> {
  const scoped = userId !== null;
  const byUser = scoped ? 'WHERE user_id = $1' : '';
  const params = scoped ? [userId] : [];

  const counts = await Promise.all([
    countRows(
      client,
      'users',
      scoped
        ? 'SELECT COUNT(*)::text AS cnt FROM users WHERE id = $1'
        : 'SELECT COUNT(*)::text AS cnt FROM users',
      params,
    ),
    countRows(client, '  ebay_accounts (cascade)', `SELECT COUNT(*)::text AS cnt FROM ebay_accounts ${byUser}`, params),
    countRows(client, '  amazon_accounts (cascade)', `SELECT COUNT(*)::text AS cnt FROM amazon_accounts ${byUser}`, params),
    countRows(client, '  listings (cascade)', `SELECT COUNT(*)::text AS cnt FROM listings ${byUser}`, params),
    countRows(client, '  orders (cascade)', `SELECT COUNT(*)::text AS cnt FROM orders ${byUser}`, params),
    countRows(client, '  store_settings (cascade)', `SELECT COUNT(*)::text AS cnt FROM store_settings ${byUser}`, params),
    countRows(
      client,
      'ebay_trial_ledger',
      scoped
        ? 'SELECT COUNT(*)::text AS cnt FROM ebay_trial_ledger WHERE first_user_id = $1'
        : 'SELECT COUNT(*)::text AS cnt FROM ebay_trial_ledger',
      params,
    ),
    countRows(
      client,
      'billing_customers',
      scoped
        ? 'SELECT COUNT(*)::text AS cnt FROM billing_customers WHERE user_id = $1'
        : 'SELECT COUNT(*)::text AS cnt FROM billing_customers',
      params,
    ),
    countRows(client, 'aquiline_profiles', `SELECT COUNT(*)::text AS cnt FROM aquiline_profiles ${byUser}`, params),
  ]);

  if (includeProducts) {
    counts.push(await countRows(client, 'products', 'SELECT COUNT(*)::text AS cnt FROM products', []));
  }
  return counts;
}

/**
 * THE ORDER HERE IS LOAD-BEARING.
 *
 * `billing_customers.user_id` and `ebay_trial_ledger.first_user_id` are both
 * ON DELETE SET NULL. Deleting the user first would sever the only link back to
 * their rows, so in `--email` mode those rows would silently survive as
 * unattributable orphans. Both are therefore removed BEFORE the user.
 *
 * `products` goes last: `listings.product_id` references it, and those listings
 * only disappear with the user.
 */
async function applyReset(
  client: PoolClient,
  userId: string | null,
  includeProducts: boolean,
): Promise<Array<{ table: string; deleted: number }>> {
  const results: Array<{ table: string; deleted: number }> = [];
  const scoped = userId !== null;

  const run = async (table: string, sql: string, params: unknown[]): Promise<void> => {
    const res = await client.query(sql, params);
    results.push({ table, deleted: res.rowCount ?? 0 });
  };

  if (scoped) {
    await run('billing_customers', 'DELETE FROM billing_customers WHERE user_id = $1', [userId]);
    await run('ebay_trial_ledger', 'DELETE FROM ebay_trial_ledger WHERE first_user_id = $1', [userId]);
    await run('aquiline_profiles', 'DELETE FROM aquiline_profiles WHERE user_id = $1', [userId]);
    await run('users', 'DELETE FROM users WHERE id = $1', [userId]);
  } else {
    // Unqualified, so rows already orphaned by an earlier reset are cleared too.
    await run('billing_customers', 'DELETE FROM billing_customers', []);
    await run('ebay_trial_ledger', 'DELETE FROM ebay_trial_ledger', []);
    await run('aquiline_profiles', 'DELETE FROM aquiline_profiles', []);
    await run('users', 'DELETE FROM users', []);
  }

  if (includeProducts) {
    await run('products', 'DELETE FROM products', []);
  }
  return results;
}

async function run(): Promise<number> {
  let args: ResetUsersArgs;
  try {
    args = parseResetUsersArgs(process.argv.slice(2));
    assertResetPlanIsSafe();
  } catch (error: unknown) {
    if (error instanceof ResetUsersArgError) {
      logError(`${error.message}\n${USAGE}`);
      return 2;
    }
    throw error;
  }

  if (process.env.NODE_ENV === 'production') {
    logError('refusing to run: NODE_ENV=production. This script is for local/test databases only.');
    return 1;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError('DATABASE_URL not set');
    return 1;
  }

  // The NODE_ENV check above is fail-OPEN and cannot stand alone: unset,
  // misspelled or dropped by the shell, it silently passes — and unset is the
  // COMMON case, since `pnpm dev` never sets it. So the dangerous condition is
  // established positively from DATABASE_URL. An unparseable URL counts as
  // remote: "we could not tell" must never read as "safe to wipe".
  if (!isLocalDatabaseUrl(databaseUrl) && !args.allowRemote) {
    logError(
      `refusing to run: ${describeDatabase(databaseUrl)} is not a local database.\n` +
        'If you really mean to wipe a remote database, re-run with --allow-remote.',
    );
    return 1;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    log(`database: ${describeDatabase(databaseUrl)}`);
    log(args.email ? `scope:    single user <${args.email}>` : 'scope:    ALL users');
    log('');

    let userId: string | null = null;
    if (args.email) {
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [args.email],
      );
      if (!rows[0]) {
        logError(`user not found: ${args.email}`);
        return 3;
      }
      userId = rows[0].id;
    }

    const counts = await collectCounts(client, userId, args.includeProducts);
    log('rows in scope:');
    for (const { label, count } of counts) {
      log(`  ${label.padEnd(28)} ${String(count).padStart(6)}`);
    }
    log('');

    if (counts.every(({ count }) => count === 0)) {
      log('nothing to delete.');
      return 0;
    }

    if (!args.confirmed) {
      log('DRY RUN — nothing was deleted. Re-run with --yes to apply.');
      if (!args.includeProducts) {
        log('(products cache is kept by default; add --products to clear it too)');
      }
      return 0;
    }

    await client.query('BEGIN');
    const results = await applyReset(client, userId, args.includeProducts);
    await client.query('COMMIT');

    log('deleted:');
    for (const { table, deleted } of results) {
      log(`  ${table.padEnd(28)} ${String(deleted).padStart(6)}`);
    }
    log('');
    log('done. Catalog and configuration were left untouched:');
    log('  billing_plans / plan_limits / plan_prices / quota_addons, platform_settings,');
    log('  predefined_templates, email_templates, buyer_message_system_defaults,');
    log('  ebay_category_map / ebay_aspect_defaults / ebay_category_aspects, migrations.');
    log('');
    log('NOTE: Aquiline profiles were removed locally only. The provider-side profile');
    log('cannot be deleted, so a re-registered user mints a new one and consumes another');
    log('of the plan\'s fixed profile slots — only if tracking conversion is enabled.');
    return 0;
  } catch (error: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // best-effort rollback; the connection is being released anyway
    }
    logError(`reset failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void run().then((code) => {
  process.exit(code);
});
