import { Injectable, Logger } from '@nestjs/common';
import { KeepaUsageSource, type KeepaApiMeta } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

interface LogUsageParams {
  asin: string;
  tokens: number;
  source: KeepaUsageSource;
  /** User IDs actively listing this ASIN (for fair-split attribution). */
  userIds: string[];
}

/**
 * Persists Keepa token spend (per-ASIN, fair-split across users) and balance
 * snapshots. Storage-only — admin reads these tables directly via SQL (no UI yet).
 */
@Injectable()
export class KeepaUsageService {
  private readonly logger = new Logger(KeepaUsageService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** Insert one per-ASIN token-spend row. Failures never break the caller. */
  async logUsage({ asin, tokens, source, userIds }: LogUsageParams): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO keepa_usage_log (asin, tokens, source, user_ids)
         VALUES ($1, $2, $3, $4)`,
        [asin, tokens, source, JSON.stringify(userIds)]
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to log Keepa usage for ASIN ${asin}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Snapshot the shared token balance if the response carried it. */
  async captureBalance(meta: KeepaApiMeta): Promise<void> {
    if (meta.tokensLeft === undefined) {
      return;
    }
    try {
      await this.databaseService.query(
        `INSERT INTO keepa_balance (tokens_left, refill_in_ms) VALUES ($1, $2)`,
        [meta.tokensLeft, meta.refillIn ?? null]
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to capture Keepa balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
