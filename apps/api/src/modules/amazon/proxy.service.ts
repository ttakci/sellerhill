import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProxyStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';

import { proxySessionToken } from './auto-fulfill-helpers';

export interface ProxyConfig {
  server: string;
  username: string;
  password: string;
}

/** Row shape for the `proxies` pool (migration 057). */
interface ProxyRow {
  host: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Prefix marking an encrypted-at-rest proxy password. Operator INSERTs may be
 * plaintext; the boot backfill re-encrypts them (same pattern as ebay tokens).
 */
const PASS_ENC_PREFIX = 'enc:';

/**
 * Zonds-provided proxy layer. Users never configure this.
 *
 * PRIMARY model (migration 057): a pool of FIXED ISP proxies (static IP,
 * unlimited bandwidth) in the `proxies` table. Each user is lazily assigned
 * exactly ONE proxy (UNIQUE assigned_user_id, atomic FOR UPDATE SKIP LOCKED
 * claim) — all of that user's Amazon buyer accounts exit from the same static
 * IP, mirroring the "one household, several accounts" pattern. When the pool
 * has active rows it is authoritative: an exhausted pool resolves to null
 * (checkout fails closed with proxy_required; scraping runs direct).
 *
 * LEGACY fallback (env, used only when the pool has no active rows): a single
 * rotating-residential template with a sticky {session} token —
 * PROXY_ENDPOINT / PROXY_USER / PROXY_PASS_TEMPLATE / PROXY_STRATEGY.
 * Kept so dev/test environments keep working without seeding the table.
 */
@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly logger = new Logger(ProxyService.name);
  // Legacy env template (fallback only).
  private readonly endpoint = process.env.PROXY_ENDPOINT; // e.g. gate.smartproxy.com:7000
  private readonly user = process.env.PROXY_USER; // base username; may contain {session}
  private readonly passTpl = process.env.PROXY_PASS_TEMPLATE; // may contain {session}
  private readonly strategy = (process.env.PROXY_STRATEGY as 'perUser' | 'perAccount') || 'perUser';
  /**
   * At-rest encryption for pool passwords. Same key as Amazon buyer-account
   * credentials; the app already cannot boot without it (AmazonAccountsService
   * throws), so requiring it here adds no new burden.
   */
  private readonly encryption: EncryptionUtil;

  constructor(private readonly databaseService: DatabaseService) {
    const key = process.env.AMAZON_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AMAZON_ENCRYPTION_KEY environment variable is required');
    }
    this.encryption = new EncryptionUtil(key);
  }

  /**
   * One-time lazy migration: encrypt any plaintext proxy passwords the
   * operator inserted. Best-effort — never blocks boot.
   */
  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.databaseService.query<{ id: string; password: string }>(
        `SELECT id, password FROM proxies WHERE password NOT LIKE $1`,
        [`${PASS_ENC_PREFIX}%`],
      );
      for (const row of rows) {
        await this.databaseService.query(
          `UPDATE proxies SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [PASS_ENC_PREFIX + this.encryption.encrypt(row.password), row.id],
        );
      }
      if (rows.length > 0) {
        this.logger.log(`Encrypted ${rows.length} plaintext proxy password(s) at rest`);
      }
    } catch (err) {
      // Table may not exist yet on first boot before migrations — harmless.
      this.logger.warn(`Proxy password backfill skipped: ${(err as Error).message}`);
    }
  }

  /**
   * True iff SOME proxy capacity exists: the pool has at least one ACTIVE row,
   * or the legacy env template is set. Used by the enable-time and runtime
   * auto-fulfill guards. NOTE: with a pool this does not guarantee THIS user
   * can get one (pool may be exhausted) — `resolve` + the checkout's
   * isProxyActive re-check remain the authoritative fail-closed gate.
   */
  async isConfigured(): Promise<boolean> {
    if (await this.poolHasActiveRows()) {
      return true;
    }
    return this.envConfigured();
  }

  /**
   * Resolve the proxy for a user (all their Amazon accounts share it).
   *
   * Order: existing pool assignment → atomic claim of a free ACTIVE pool row
   * → (pool empty entirely) legacy env template → null. A pool that exists
   * but is exhausted deliberately does NOT fall back to env: mixing one
   * user's static-IP model with another's rotating template would make IP
   * behavior unpredictable per user.
   */
  async resolve(userId: string, amazonAccountId: string): Promise<ProxyConfig | null> {
    try {
      // 1. Existing assignment (must still be ACTIVE — a disabled/burned
      // proxy is never used; the claim below picks a replacement).
      const assigned = await this.databaseService.query<ProxyRow>(
        `SELECT host, port, username, password FROM proxies
          WHERE assigned_user_id = $1 AND status = $2
          LIMIT 1`,
        [userId, ProxyStatus.ACTIVE],
      );
      if (assigned[0]) {
        return this.toConfig(assigned[0]);
      }

      // 2. Atomic claim: oldest free ACTIVE proxy. SKIP LOCKED means two
      // concurrent first-resolves for different users can never claim the
      // same row; UNIQUE assigned_user_id makes a double-claim for the SAME
      // user impossible.
      const claimed = await this.databaseService.query<ProxyRow>(
        `UPDATE proxies
            SET assigned_user_id = $1, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = (
            SELECT id FROM proxies
             WHERE assigned_user_id IS NULL AND status = $2
             ORDER BY created_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
          RETURNING host, port, username, password`,
        [userId, ProxyStatus.ACTIVE],
      );
      if (claimed[0]) {
        this.logger.log(`Claimed pool proxy ${claimed[0].host}:${claimed[0].port} for user ${userId}`);
        return this.toConfig(claimed[0]);
      }

      // 3. Pool authoritative when it has active rows: exhausted → null.
      if (await this.poolHasActiveRows()) {
        this.logger.warn(
          `Proxy pool exhausted — no free ACTIVE proxy for user ${userId}; resolve = null (checkout will fail closed)`,
        );
        return null;
      }
    } catch (err) {
      this.logger.warn(
        `Proxy pool lookup failed for user ${userId}: ${(err as Error).message} — trying env fallback`,
      );
    }

    return this.resolveFromEnv(userId, amazonAccountId);
  }

  /**
   * Enable-time guard helper: does THIS user have (or can they claim) a
   * proxy right now? Claims eagerly so the user gets immediate feedback at
   * enable time instead of a runtime proxy_required block on their first
   * order. Env-fallback mode returns true without claiming (template covers
   * every user).
   */
  async ensureAvailableFor(userId: string, amazonAccountId: string): Promise<boolean> {
    return (await this.resolve(userId, amazonAccountId)) !== null;
  }

  private toConfig(row: ProxyRow): ProxyConfig {
    return {
      server: `${row.host}:${row.port}`,
      username: row.username,
      password: this.decryptPassword(row.password),
    };
  }

  private decryptPassword(stored: string): string {
    if (!stored.startsWith(PASS_ENC_PREFIX)) {
      return stored; // operator-inserted plaintext not yet backfilled
    }
    return this.encryption.decrypt(stored.slice(PASS_ENC_PREFIX.length));
  }

  private async poolHasActiveRows(): Promise<boolean> {
    try {
      const rows = await this.databaseService.query<{ ok: number }>(
        `SELECT 1 AS ok FROM proxies WHERE status = $1 LIMIT 1`,
        [ProxyStatus.ACTIVE],
      );
      return rows.length > 0;
    } catch {
      return false; // table missing pre-migration → env fallback governs
    }
  }

  private envConfigured(): boolean {
    return Boolean(this.endpoint && this.user);
  }

  /** Legacy rotating-residential template with sticky {session} token. */
  private resolveFromEnv(userId: string, amazonAccountId: string): ProxyConfig | null {
    if (!this.envConfigured()) {
      return null;
    }
    const session = proxySessionToken(this.strategy, userId, amazonAccountId);
    const endpoint = this.endpoint as string;
    const baseUser = this.user as string;
    const username = baseUser.includes('{session}')
      ? baseUser.replace('{session}', session)
      : `${baseUser}-session-${session}`;
    const password = this.passTpl ? this.passTpl.replace('{session}', session) : '';
    return { server: endpoint, username, password };
  }
}
