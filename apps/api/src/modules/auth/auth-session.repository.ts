import { Injectable } from '@nestjs/common';
import type { UserRole, UserStatus } from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';

export interface SessionAuthority {
  sessionId: string;
  familyId: string;
  userId: string;
  secretHash: string;
  sessionVersion: number;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  role: UserRole;
  status: UserStatus;
  currentSessionVersion: number;
  email: string;
}

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly database: DatabaseService) {}

  create(input: { id: string; familyId: string; userId: string; secretHash: string; sessionVersion: number; expiresAt: Date }): Promise<void> {
    return this.database.query(
      `INSERT INTO auth_refresh_sessions (id, family_id, user_id, secret_hash, session_version, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.id, input.familyId, input.userId, input.secretHash, input.sessionVersion, input.expiresAt.toISOString()]
    ).then(() => undefined);
  }

  async lock(client: PoolClient, id: string): Promise<SessionAuthority | null> {
    const result = await client.query<{
      id: string; family_id: string; user_id: string; secret_hash: string; session_version: number;
      expires_at: Date; revoked_at: Date | null; replaced_by_session_id: string | null;
      role: UserRole; status: UserStatus; current_session_version: number; email: string;
    }>(`SELECT s.id, s.family_id, s.user_id, s.secret_hash, s.session_version, s.expires_at,
              s.revoked_at, s.replaced_by_session_id, u.role, u.status,
              u.session_version AS current_session_version, u.email
       FROM auth_refresh_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 FOR UPDATE OF s`, [id]);
    const row = result.rows[0];
    return row ? { sessionId: row.id, familyId: row.family_id, userId: row.user_id, secretHash: row.secret_hash,
      sessionVersion: row.session_version, expiresAt: row.expires_at, revokedAt: row.revoked_at,
      replacedBySessionId: row.replaced_by_session_id, role: row.role, status: row.status,
      currentSessionVersion: row.current_session_version, email: row.email } : null;
  }

  async rotate(client: PoolClient, oldId: string, next: { id: string; familyId: string; userId: string; secretHash: string; sessionVersion: number; expiresAt: Date }): Promise<void> {
    await client.query(`INSERT INTO auth_refresh_sessions (id, family_id, user_id, secret_hash, session_version, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6)`, [next.id, next.familyId, next.userId, next.secretHash, next.sessionVersion, next.expiresAt]);
    await client.query(`UPDATE auth_refresh_sessions SET revoked_at = NOW(), last_used_at = NOW(), replaced_by_session_id = $1 WHERE id = $2`, [next.id, oldId]);
  }

  async revokeFamily(client: PoolClient, familyId: string, reusedId?: string): Promise<void> {
    await client.query(`UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()),
      reuse_detected_at = CASE WHEN id = $2 THEN NOW() ELSE reuse_detected_at END WHERE family_id = $1`, [familyId, reusedId ?? null]);
  }

  revokeSession(id: string): Promise<void> {
    return this.database.query('UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1', [id]).then(() => undefined);
  }

  revokeUser(userId: string): Promise<void> {
    return this.database.query('UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL', [userId]).then(() => undefined);
  }

  async loadAuthority(sessionId: string, userId: string): Promise<SessionAuthority | null> {
    const rows = await this.database.query<{
      id: string; family_id: string; user_id: string; secret_hash: string; session_version: number;
      expires_at: Date; revoked_at: Date | null; replaced_by_session_id: string | null;
      role: UserRole; status: UserStatus; current_session_version: number; email: string;
    }>(`SELECT s.id, s.family_id, s.user_id, s.secret_hash, s.session_version, s.expires_at,
       s.revoked_at, s.replaced_by_session_id, u.role, u.status, u.session_version current_session_version, u.email
       FROM auth_refresh_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2`, [sessionId, userId]);
    const row = rows[0];
    return row ? { sessionId: row.id, familyId: row.family_id, userId: row.user_id, secretHash: row.secret_hash,
      sessionVersion: row.session_version, expiresAt: row.expires_at, revokedAt: row.revoked_at,
      replacedBySessionId: row.replaced_by_session_id, role: row.role, status: row.status,
      currentSessionVersion: row.current_session_version, email: row.email } : null;
  }
}
