import {
  assertResetPlanIsSafe,
  buildResetPlan,
  isLocalDatabaseUrl,
  parseResetUsersArgs,
  PROTECTED_TABLES,
  RESET_TARGET_TABLES,
  ResetUsersArgError,
} from './reset-users-helpers';

describe('isLocalDatabaseUrl', () => {
  it('accepts the usual local hosts', () => {
    expect(isLocalDatabaseUrl('postgres://u:p@localhost:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@127.0.0.1:5432/db')).toBe(true);
  });

  it('rejects a remote host', () => {
    expect(isLocalDatabaseUrl('postgres://u:p@db.example.com:5432/db')).toBe(false);
    expect(isLocalDatabaseUrl('postgres://u:p@10.0.0.7:5432/db')).toBe(false);
  });

  it('treats an unparseable URL as remote — the guard fails CLOSED', () => {
    // "We could not tell" must never read as "safe to wipe". The NODE_ENV check
    // this backs up is fail-open on its own: unset is both the common case and
    // the one that silently passes it.
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
    expect(isLocalDatabaseUrl('')).toBe(false);
  });
});

describe('parseResetUsersArgs', () => {
  it('defaults to a dry run over every user, keeping the products cache', () => {
    expect(parseResetUsersArgs([])).toEqual({
      email: null,
      confirmed: false,
      includeProducts: false,
      allowRemote: false,
    });
  });

  it('reads --yes, --products and --email in any order', () => {
    expect(parseResetUsersArgs(['--products', '--email', 'a@b.c', '--yes'])).toEqual({
      email: 'a@b.c',
      confirmed: true,
      includeProducts: true,
      allowRemote: false,
    });
  });

  it('trims the email value', () => {
    expect(parseResetUsersArgs(['--email', '  a@b.c  ']).email).toBe('a@b.c');
  });

  it('ignores the literal "--" that pnpm run forwards', () => {
    // `pnpm --filter api run reset-users -- --yes` really does hand the script
    // argv ['--', '--yes']. Rejecting it makes the documented invocation fail.
    expect(parseResetUsersArgs(['--', '--yes'])).toEqual({
      email: null,
      confirmed: true,
      includeProducts: false,
      allowRemote: false,
    });
    expect(parseResetUsersArgs(['--', '--email', 'a@b.c']).email).toBe('a@b.c');
  });

  it('rejects an unknown flag rather than ignoring it', () => {
    // A typo'd flag on a destructive script must not silently degrade into a
    // broader delete than the operator asked for.
    expect(() => parseResetUsersArgs(['--all'])).toThrow(ResetUsersArgError);
    expect(() => parseResetUsersArgs(['--Yes'])).toThrow(ResetUsersArgError);
  });

  it('rejects --email with no value, including a following flag', () => {
    expect(() => parseResetUsersArgs(['--email'])).toThrow(ResetUsersArgError);
    expect(() => parseResetUsersArgs(['--email', '--yes'])).toThrow(ResetUsersArgError);
    expect(() => parseResetUsersArgs(['--email', '   '])).toThrow(ResetUsersArgError);
  });
});

describe('reset plan safety', () => {
  it('never targets a protected catalog or configuration table', () => {
    expect(() => assertResetPlanIsSafe()).not.toThrow();
  });

  it('refuses a plan that would delete a protected table', () => {
    expect(() => assertResetPlanIsSafe([{ table: 'billing_plans' }])).toThrow(
      /protected table "billing_plans"/,
    );
  });

  it('guards the cascade root as well as the explicit targets', () => {
    // `users` is the cascade root and is checked even though it is not in
    // RESET_TARGET_TABLES — a future edit must not be able to protect it and
    // silently keep deleting it, or vice versa.
    expect(() => assertResetPlanIsSafe([], ['users'])).toThrow(/protected table "users"/);
  });

  it('keeps the three non-cascading tables in the plan', () => {
    // Each of these deliberately outlives the account that created it, so
    // dropping one from the plan silently breaks a reset: a kept trial ledger
    // row denies the re-registered store its trial.
    const tables = RESET_TARGET_TABLES.filter((t) => !t.optional).map((t) => t.table);
    expect(tables).toEqual(['ebay_trial_ledger', 'billing_customers', 'aquiline_profiles']);
  });

  it('lists no table twice', () => {
    const tables = RESET_TARGET_TABLES.map((t) => t.table);
    expect(new Set(tables).size).toBe(tables.length);
    expect(new Set(PROTECTED_TABLES).size).toBe(PROTECTED_TABLES.length);
  });
});

describe('buildResetPlan', () => {
  const args = { email: null, confirmed: true, includeProducts: false, allowRemote: false };

  it('omits the products cache unless it was asked for', () => {
    expect(buildResetPlan(args).map((t) => t.table)).not.toContain('products');
  });

  it('includes the products cache with --products, last', () => {
    const plan = buildResetPlan({ ...args, includeProducts: true }).map((t) => t.table);
    expect(plan).toContain('products');
    expect(plan[plan.length - 1]).toBe('products');
  });
});
