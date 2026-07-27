// apps/api/src/scripts/user-set-role.ts
//
// Operator-only CLI to promote/demote a user's role. There is NO HTTP path —
// role escalation is intentionally a server-console operation so it cannot be
// reached through the running API surface. Run it with tsx:
//
//   pnpm --filter api run user:set-role -- --email alice@example.com --role admin
//
// Security contract (matches CLAUDE.md "Role CLI" section):
//   1. Strict `--email`/`--role` parsing via the shared `UserRole` enum (no env
//      fallback, no positional args, no HTTP). `RoleCliArgError` → usage + exit 2.
//   2. Transactionally lock the target user with `SELECT ... FOR UPDATE` so a
//      concurrent role change cannot race.
//   3. Change the role only when it actually differs (`shouldChangeRole`) — a
//      no-op run exits 0 without writing anything.
//   4. On change: revoke all active refresh sessions for the user explicitly.
//      Migration 041's `users_security_change_revoke_sessions` trigger also
//      bumps `session_version` + revokes sessions on the UPDATE — the explicit
//      UPDATE below is belt-and-suspenders, not a substitute for the trigger.
//   5. Insert a durable, REDACTED audit row into `audit_logs` IN THE SAME
//      transaction, so the audit record commits atomically with the role change
//      (or rolls back with it). The `details` JSONB carries only the role
//      transition + target user id + optional actor id — never email/password/
//      session secrets. See `user-set-role-helpers.buildRoleChangeAuditDetails`.
//
// Exit codes:
//   0  — role changed (or already the target role: no-op success)
//   2  — bad arguments (usage error)
//   3  — user not found
//   1  — any other failure (DB, transaction, etc.)

import * as path from 'path';

import { UserRole } from '@repo/shared';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import {
  buildRoleChangeAuditDetails,
  parseRoleCliArgs,
  RoleCliArgError,
  shouldChangeRole,
} from './user-set-role-helpers';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface TargetUserRow {
  id: string;
  email: string;
  role: UserRole;
}

const USAGE = [
  'Usage: pnpm --filter api run user:set-role -- --email <email> --role <customer|support|admin>',
  '',
  'Operator-only CLI. No HTTP path. Changes a user role, revokes active sessions,',
  'and writes a durable redacted audit row in one transaction.',
].join('\n');

function log(msg: string): void {
  console.warn(msg);
}

function logError(msg: string): void {
  console.error(msg);
}

async function run(): Promise<number> {
  let parsed;
  try {
    parsed = parseRoleCliArgs(process.argv.slice(2));
  } catch (error: unknown) {
    if (error instanceof RoleCliArgError) {
      logError(`${error.message}\n${USAGE}`);
      return 2;
    }
    throw error;
  }
  const { email, role } = parsed;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError('DATABASE_URL not set');
    return 1;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the target user row. LOWER(email) matches the auth lookup path.
    const selectResult = await client.query<TargetUserRow>(
      'SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE',
      [email],
    );
    const target = selectResult.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      logError(`user not found: ${email}`);
      return 3;
    }

    const previousRole = target.role;

    // 2. No-op when the role already matches.
    if (!shouldChangeRole(previousRole, role)) {
      await client.query('ROLLBACK');
      log(`no change: ${target.email} already has role "${role}"`);
      return 0;
    }

    // 3. Update the role. The 041 trigger bumps session_version + revokes
    //    auth_refresh_sessions on this UPDATE; the explicit revoke below is
    //    defense-in-depth (also catches sessions if the trigger were ever dropped).
    await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, target.id]);

    // 4. Explicitly revoke all active refresh sessions for the user.
    await client.query(
      'UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL',
      [target.id],
    );

    // 5. Durable, redacted audit row — same transaction. `action` is the literal
    //    'ROLE_CHANGE' (audit_logs.action is VARCHAR(50); the AuditLogService
    //    union is not extended here to avoid a shared-code change for a CLI-only
    //    action). `details` carries the redacted payload from the pure helper.
    const details = buildRoleChangeAuditDetails({
      previousRole,
      newRole: role,
      targetUserId: target.id,
      actor: process.env.USER || process.env.USERNAME || null,
    });
    await client.query(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        target.id,
        details.action,
        'user',
        target.id,
        JSON.stringify(details),
        null, // CLI runs on the server console — no client IP.
      ],
    );

    await client.query('COMMIT');
    log(`role changed: ${target.email} "${previousRole}" -> "${role}" (sessions revoked, audit logged)`);
    return 0;
  } catch (error: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // best-effort rollback; the connection is being released anyway
    }
    logError(
      `role change failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void run().then((code) => {
  process.exit(code);
});
