import { Injectable, Logger } from '@nestjs/common';
import { KeepaUsageSource, type KeepaApiMeta } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { UsageEventsService } from '../admin/usage-events.service';

import { buildKeepaUsageEvents } from './keepa-projection';

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

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usageEventsService: UsageEventsService
  ) {}

  /** Insert source usage, then project it into the append-only FinOps ledger. */
  async logUsage({ asin, tokens, source, userIds }: LogUsageParams): Promise<void> {
    let sourceLogId: string | undefined;
    try {
      const rows = await this.databaseService.query<{ id: string }>(
        `INSERT INTO keepa_usage_log (asin, tokens, source, user_ids)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [asin, tokens, source, JSON.stringify(userIds)]
      );
      sourceLogId = rows[0]?.id;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to log Keepa usage for ASIN ${asin}: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    if (!sourceLogId) {return;}
    const events = buildKeepaUsageEvents({ sourceLogId, tokens, keepaSource: source, asin, userIds });
    const results = await this.usageEventsService.appendBatch(events);
    const failed = results.filter((result) => result.failed).length;
    if (failed > 0) {
      this.logger.warn(`Keepa usage projection failed for ${failed}/${results.length} events; source log retained`);
    }
  }

  /** Snapshot the shared token balance if the response carried it. */
  async captureBalance(meta: KeepaApiMeta): Promise<void> {
    if (meta.tokensLeft === undefined) {
      return;
    }
    try {
      await this.databaseService.query(
        `INSERT INTO keepa_balance (tokens_left, refill_in_ms, refill_rate) VALUES ($1, $2, $3)`,
        [meta.tokensLeft, meta.refillIn ?? null, meta.refillRate ?? null]
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to capture Keepa balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
