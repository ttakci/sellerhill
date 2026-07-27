// apps/api/src/scripts/user-set-role-helpers.ts
//
// Pure helpers for the operator-only `user-set-role` CLI. Extracted from the
// script so the parsing / validation / audit-shape logic is unit-testable
// without a database. The script (user-set-role.ts) owns the Pool + transaction
// and calls into these helpers.
//
// Security invariants enforced here:
//   - `--email` and `--role` are both required and strictly parsed (no positional
//     args, no env fallback, no HTTP path). Unknown flags are rejected.
//   - `--role` must be a member of the shared `UserRole` enum (single source of
//     truth). String literals like 'admin' never appear in the script.
//   - The audit `details` payload is REDACTED: it records only the role
//     transition, the target user id, and an optional actor identifier. It never
//     embeds passwords, emails (the users table already stores the email; the
//     audit row is joined to the user via `user_id`), session secrets, or PII
//     beyond what `audit_logs` already exists to hold.

import { UserRole } from '@repo/shared';

/** Result of strictly parsing the CLI argv. */
export interface ParsedRoleCliArgs {
  email: string;
  role: UserRole;
}

/** A redacted, serializable description of a role change for `audit_logs.details`. */
export interface RoleChangeAuditDetails {
  action: 'ROLE_CHANGE';
  previousRole: UserRole;
  newRole: UserRole;
  targetUserId: string;
  /** Operator who ran the command. `null` when run unattended. Redacted to an opaque id only. */
  actor: string | null;
  /** ISO 8601 timestamp when the change was applied (server clock). */
  changedAt: string;
}

/** Typed error so the script can print a clean usage message vs a stack trace. */
export class RoleCliArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoleCliArgError';
  }
}

/** Strict `--email <value>` / `--role <value>` parser. Throws on any deviation. */
export function parseRoleCliArgs(argv: string[]): ParsedRoleCliArgs {
  // `argv` here is the slice after the script path (process.argv.slice(2)).
  const knownFlags = new Set(['--email', '--role']);
  const parsed: { email?: string; role?: string } = {};
  const extras: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--email') {
      const val = argv[++i];
      if (val === undefined || val.startsWith('--')) {
        throw new RoleCliArgError('--email requires a value');
      }
      parsed.email = val;
    } else if (tok === '--role') {
      const val = argv[++i];
      if (val === undefined || val.startsWith('--')) {
        throw new RoleCliArgError('--role requires a value');
      }
      parsed.role = val;
    } else if (tok.startsWith('--email=')) {
      parsed.email = tok.slice('--email='.length);
    } else if (tok.startsWith('--role=')) {
      parsed.role = tok.slice('--role='.length);
    } else {
      extras.push(tok);
    }
  }

  // Reject anything that is not a known flag — strict parsing, no silent ignore.
  void knownFlags;
  if (extras.length > 0) {
    throw new RoleCliArgError(`unknown arguments: ${extras.join(' ')}`);
  }
  if (parsed.email === undefined || parsed.email.length === 0) {
    throw new RoleCliArgError('--email is required');
  }
  if (parsed.role === undefined || parsed.role.length === 0) {
    throw new RoleCliArgError('--role is required');
  }

  const email = normalizeEmail(parsed.email);
  const role = validateRole(parsed.role);

  return { email, role };
}

/** Trim + lowercase the email (matches the users table LOWER(email) lookup). */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    throw new RoleCliArgError('--email must not be empty');
  }
  // Basic shape guard — the authoritative check is the DB lookup, but rejecting
  // obviously malformed input early gives a clearer error than a zero-row SELECT.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new RoleCliArgError(`--email is not a valid email address: ${trimmed}`);
  }
  return trimmed.toLowerCase();
}

/** Validate that the role string is a `UserRole` enum member. */
export function validateRole(role: string): UserRole {
  const values = Object.values(UserRole) as string[];
  if (!values.includes(role)) {
    throw new RoleCliArgError(
      `--role must be one of ${values.join(', ')} (got "${role}")`,
    );
  }
  return role as UserRole;
}

/** True only when the role actually changes — guards no-op writes. */
export function shouldChangeRole(current: UserRole, next: UserRole): boolean {
  return current !== next;
}

/**
 * Build the REDACTED audit details payload. Deliberately excludes email,
 * password material, session secrets, and any free-form operator note. The
 * `audit_logs` row is linked to the user via `user_id`, so the email is
 * recoverable by joining to `users` when needed — it is not duplicated here.
 */
export function buildRoleChangeAuditDetails(input: {
  previousRole: UserRole;
  newRole: UserRole;
  targetUserId: string;
  actor?: string | null;
}): RoleChangeAuditDetails {
  const actor = input.actor === undefined ? null : input.actor;
  return {
    action: 'ROLE_CHANGE',
    previousRole: input.previousRole,
    newRole: input.newRole,
    targetUserId: input.targetUserId,
    actor: actor === '' ? null : actor,
    changedAt: new Date().toISOString(),
  };
}
