// apps/api/src/scripts/billing-reconcile-helpers.ts
//
// Pure helpers for `billing-reconcile.ts`. Extracted and unit-tested for the
// same reason `reset-users-helpers.ts` / `user-set-role-helpers.ts` are: the
// script itself is a pg/Stripe shell, and everything that decides WHAT gets
// written belongs somewhere a test can hold it without a database or a live
// Stripe key. That includes the synthetic-event envelope and the plan-id pull
// — the one novel, drift-prone piece this CLI introduces.

/** Thrown for a usage error; the caller prints usage and exits 2. */
export class ReconcileArgError extends Error {}

// The synthetic-event envelope and the plan-id pull MOVED to
// `modules/billing/subscription-reconcile.ts` when the periodic reconcile job
// was added — two callers now need them, and a second copy of the envelope
// shape is exactly the drift this file's header warns about. Re-exported here
// so the CLI (and its spec) keep one import site.
export {
  buildReconcileEvent,
  RECONCILE_EVENT_TYPE,
  resolveReconcilePlanId,
} from '../modules/billing/subscription-reconcile';

export interface ReconcileArgs {
  /** The account to reconcile, looked up by `LOWER(email)`. Required. */
  email: string;
  /** Print what would be written and exit without writing. */
  dryRun: boolean;
}

/**
 * Parse `--email <email> [--dry-run]`. Strict, like the sibling CLIs:
 *  - a bare `--` is skipped (pnpm forwards a literal `--` through
 *    `pnpm run <script> -- --flag`; the same footgun CLAUDE.md documents for
 *    user:set-role, where the strict parser would otherwise exit 2);
 *  - `--email` requires a following value that is not itself a flag;
 *  - any other token is an error.
 */
export function parseReconcileArgs(argv: readonly string[]): ReconcileArgs {
  let email: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--':
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--email': {
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
          throw new ReconcileArgError('--email requires a value');
        }
        email = value.trim();
        if (email.length === 0) {
          throw new ReconcileArgError('--email requires a value');
        }
        i += 1;
        break;
      }
      default:
        throw new ReconcileArgError(`unknown argument: ${arg}`);
    }
  }

  if (!email) {
    throw new ReconcileArgError('--email is required');
  }

  return { email, dryRun };
}
