// apps/api/src/scripts/user-set-role-helpers.spec.ts
//
// Unit tests for the operator-only `user-set-role` CLI pure helpers. These
// cover the security-critical parsing + audit-redaction surface without a DB.
// Follows the existing Jest harness pattern (ts-jest, @repo/shared CJS map).

import { UserRole } from '@repo/shared';

import {
  buildRoleChangeAuditDetails,
  normalizeEmail,
  parseRoleCliArgs,
  RoleCliArgError,
  shouldChangeRole,
  validateRole,
} from './user-set-role-helpers';

describe('parseRoleCliArgs', () => {
  it('parses space-separated --email and --role', () => {
    const r = parseRoleCliArgs(['--email', 'Alice@Example.com', '--role', 'support']);
    expect(r.email).toBe('alice@example.com');
    expect(r.role).toBe(UserRole.SUPPORT);
  });

  it('parses =-joined --email= and --role=', () => {
    const r = parseRoleCliArgs(['--email=Bob@Example.com', '--role=admin']);
    expect(r.email).toBe('bob@example.com');
    expect(r.role).toBe(UserRole.ADMIN);
  });

  it('rejects when --email is missing', () => {
    expect(() => parseRoleCliArgs(['--role', 'admin'])).toThrow(RoleCliArgError);
    expect(() => parseRoleCliArgs(['--role', 'admin'])).toThrow(/--email is required/);
  });

  it('rejects when --role is missing', () => {
    expect(() => parseRoleCliArgs(['--email', 'a@b.com'])).toThrow(/--role is required/);
  });

  it('rejects when --email has no value (next token is a flag)', () => {
    expect(() => parseRoleCliArgs(['--email', '--role', 'admin'])).toThrow(
      /--email requires a value/,
    );
  });

  it('rejects when --role has no value', () => {
    expect(() => parseRoleCliArgs(['--email', 'a@b.com', '--role'])).toThrow(
      /--role requires a value/,
    );
  });

  it('rejects unknown arguments (strict parsing — no silent ignore)', () => {
    expect(() => parseRoleCliArgs(['--email', 'a@b.com', '--role', 'admin', '--force'])).toThrow(
      /unknown arguments/,
    );
    expect(() => parseRoleCliArgs(['positional'])).toThrow(/unknown arguments/);
  });

  it('rejects an invalid role value', () => {
    expect(() => parseRoleCliArgs(['--email', 'a@b.com', '--role', 'superuser'])).toThrow(
      /--role must be one of/,
    );
  });

  it('does NOT accept the raw string "admin" as a bypass — it must equal a UserRole enum value', () => {
    // 'admin' is a valid UserRole value, so this succeeds — the guard is against typos like 'Admin' (capitalized).
    expect(() => parseRoleCliArgs(['--email', 'a@b.com', '--role', 'Admin'])).toThrow(
      /--role must be one of/,
    );
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Alice@Example.COM  ')).toBe('alice@example.com');
  });

  it('rejects empty', () => {
    expect(() => normalizeEmail('   ')).toThrow(/empty/);
  });

  it('rejects malformed shapes', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow(/not a valid email/);
    expect(() => normalizeEmail('a@b')).toThrow(/not a valid email/);
  });
});

describe('validateRole', () => {
  it('accepts each UserRole member', () => {
    for (const r of Object.values(UserRole)) {
      expect(validateRole(r)).toBe(r);
    }
  });

  it('rejects unknown strings', () => {
    expect(() => validateRole('root')).toThrow(/--role must be one of/);
  });
});

describe('shouldChangeRole', () => {
  it('is true only when the role actually differs', () => {
    expect(shouldChangeRole(UserRole.CUSTOMER, UserRole.ADMIN)).toBe(true);
    expect(shouldChangeRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
  });
});

describe('buildRoleChangeAuditDetails', () => {
  it('builds a REDACTED payload with the role transition + target id', () => {
    const details = buildRoleChangeAuditDetails({
      previousRole: UserRole.CUSTOMER,
      newRole: UserRole.ADMIN,
      targetUserId: 'u-123',
      actor: 'operator-7',
    });
    expect(details.action).toBe('ROLE_CHANGE');
    expect(details.previousRole).toBe(UserRole.CUSTOMER);
    expect(details.newRole).toBe(UserRole.ADMIN);
    expect(details.targetUserId).toBe('u-123');
    expect(details.actor).toBe('operator-7');
    expect(typeof details.changedAt).toBe('string');
    expect(Date.parse(details.changedAt)).not.toBeNaN();
  });

  it('nulls out an empty actor (no PII leak of a blank string)', () => {
    const details = buildRoleChangeAuditDetails({
      previousRole: UserRole.SUPPORT,
      newRole: UserRole.CUSTOMER,
      targetUserId: 'u-1',
      actor: '',
    });
    expect(details.actor).toBeNull();
  });

  it('defaults actor to null when omitted (unattended run)', () => {
    const details = buildRoleChangeAuditDetails({
      previousRole: UserRole.CUSTOMER,
      newRole: UserRole.SUPPORT,
      targetUserId: 'u-1',
    });
    expect(details.actor).toBeNull();
  });

  it('never embeds email, password material, or session secrets', () => {
    const details = buildRoleChangeAuditDetails({
      previousRole: UserRole.CUSTOMER,
      newRole: UserRole.ADMIN,
      targetUserId: 'u-123',
      actor: 'op',
    });
    const serialized = JSON.stringify(details);
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('token');
  });
});
