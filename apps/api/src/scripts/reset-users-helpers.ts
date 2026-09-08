// apps/api/src/scripts/reset-users-helpers.ts
//
// Pure argument parsing + the frozen delete plan for `reset-users.ts`.
// Extracted (and unit-tested) for the same reason `user-set-role-helpers.ts`
// is: the script itself is an fs/pg shell, and everything that decides WHAT
// gets destroyed belongs somewhere a test can hold it.
//
// The two lists below mirror the `data-retention.manifest.ts` idea: a frozen
// literal set of table names plus an assertion that the destructive list and
// the protected list can never intersect. Adding a table to the delete plan is
// then a deliberate edit that a spec has to agree with, rather than a one-line
// change nobody reviews.

/** Thrown for a usage error; the caller prints usage and exits 2. */
export class ResetUsersArgError extends Error {}

export interface ResetUsersArgs {
  /** Delete a single user by email, or every user when null. */
  email: string | null;
  /** Nothing is written without this — the default run is a dry run. */
  confirmed: boolean;
  /** Also clear the shared `products` ASIN cache. Off by default. */
  includeProducts: boolean;
  /** Required to target a database that is not on this machine. */
  allowRemote: boolean;
}

/**
 * Hosts treated as "this machine".
 *
 * The NODE_ENV check alone is fail-OPEN and cannot be the only guard: an unset,
 * misspelled or shell-dropped NODE_ENV silently passes it — and unset is the
 * COMMON case, since `pnpm dev` never sets it. So the dangerous condition is
 * established positively from DATABASE_URL instead: anything not resolvably
 * local needs --allow-remote.
 */
const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * Whether DATABASE_URL points at this machine. An unparseable URL is reported
 * as NOT local — the guard fails closed, because "we could not tell" must never
 * read as "safe to wipe".
 */
export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    return LOCAL_DB_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Tables this script issues an explicit DELETE against.
 *
 * Everything else goes with `users` through ON DELETE CASCADE — ebay_accounts,
 * listings, orders, amazon_accounts, store_settings, listing_settings_groups,
 * listing_jobs (+ items), buyer_message_templates, buyer_message_log,
 * billing_quota_credits, user_oauth_accounts, password_reset_tokens,
 * auth_refresh_sessions, ebay_listing_discoveries.
 *
 * The three non-optional entries after `users` are here precisely BECAUSE they
 * do not cascade — each one deliberately outlives the account that created it.
 */
export const RESET_TARGET_TABLES = [
  {
    table: 'ebay_trial_ledger',
    optional: false,
    // `first_user_id` is ON DELETE SET NULL and the PK is
    // (seller_id, marketplace_id): the row is MEANT to survive the account, so
    // one eBay store can never claim a second free trial. Leaving it behind
    // means re-registering the same store gets NO trial — i.e. the exact thing
    // a reset is usually run to test.
    reason: 'survives user deletion by design (anti-fraud); blocks a fresh trial if kept',
  },
  {
    table: 'billing_customers',
    optional: false,
    // ON DELETE SET NULL, so deleting a user ORPHANS this row rather than
    // removing it. Cascades onward to billing_subscriptions ->
    // billing_usage_periods + the listing/AO reservation ledgers.
    reason: 'orphaned by user delete (SET NULL); cascades subscriptions, usage periods, reservations',
  },
  {
    table: 'aquiline_profiles',
    optional: false,
    // No FK to `users` at all. NOTE: the provider-side profile is permanent —
    // DELETE /v1/profiles/{id} is unsupported (verified live 2026-09-02) — so
    // this only clears OUR row. A re-registered user mints a new profile and
    // consumes another of the plan's fixed profile slots.
    reason: 'no FK to users; local row only — the provider-side profile is permanent',
  },
  {
    table: 'products',
    optional: true,
    reason: 'shared ASIN cache; clearing it re-spends Keepa tokens on the next add',
  },
] as const;

/**
 * Catalog, configuration and shared-learning tables. A reset must never touch
 * these: they are either operator configuration, seeded product data, or
 * cross-customer knowledge that is expensive to rebuild.
 *
 * `ebay_category_map` / `ebay_aspect_defaults` / `ebay_category_aspects` are on
 * this list even though they carry a nullable `created_by` — the rows are
 * learned eBay taxonomy shared by every customer, and re-earning them costs
 * real Taxonomy-API quota.
 */
export const PROTECTED_TABLES = [
  'migrations',
  'platform_settings',
  'billing_plans',
  'billing_plan_limits',
  'billing_plan_prices',
  'billing_quota_addons',
  'predefined_templates',
  'email_templates',
  'buyer_message_system_defaults',
  'ebay_category_aspects',
  'ebay_category_map',
  'ebay_aspect_defaults',
] as const;

/**
 * Refuse to build a plan that would destroy catalog/config data.
 *
 * `users` is checked alongside the explicit targets so a future edit cannot
 * quietly move a protected name into the cascade root either.
 */
export function assertResetPlanIsSafe(
  targets: ReadonlyArray<{ table: string }> = RESET_TARGET_TABLES,
  protectedTables: ReadonlyArray<string> = PROTECTED_TABLES,
): void {
  const guarded = new Set(protectedTables);
  const planned = ['users', ...targets.map((t) => t.table)];
  const collision = planned.find((table) => guarded.has(table));
  if (collision) {
    throw new ResetUsersArgError(
      `refusing to build a reset plan that deletes protected table "${collision}"`,
    );
  }
}

export function parseResetUsersArgs(argv: readonly string[]): ResetUsersArgs {
  let email: string | null = null;
  let confirmed = false;
  let includeProducts = false;
  let allowRemote = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      // `pnpm run <script> -- --yes` forwards a LITERAL '--' through to argv
      // (the same footgun CLAUDE.md documents for user:set-role, where it exits
      // 2). Skipping a bare separator costs no safety — it is shell/pnpm noise,
      // never a user-supplied value — and every real flag stays strict.
      case '--':
        break;
      case '--yes':
        confirmed = true;
        break;
      case '--products':
        includeProducts = true;
        break;
      case '--allow-remote':
        allowRemote = true;
        break;
      case '--email': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new ResetUsersArgError('--email requires a value');
        }
        email = value.trim();
        if (email.length === 0) {
          throw new ResetUsersArgError('--email requires a value');
        }
        i += 1;
        break;
      }
      default:
        throw new ResetUsersArgError(`unknown argument: ${arg}`);
    }
  }

  return { email, confirmed, includeProducts, allowRemote };
}

/** The delete plan for a run, in execution order. */
export function buildResetPlan(args: ResetUsersArgs): ReadonlyArray<{ table: string }> {
  assertResetPlanIsSafe();
  return RESET_TARGET_TABLES.filter((t) => !t.optional || args.includeProducts).map((t) => ({
    table: t.table,
  }));
}
