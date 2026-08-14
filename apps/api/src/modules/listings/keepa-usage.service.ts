import { Injectable, Logger } from '@nestjs/common';
import { KeepaUsageSource, type KeepaApiMeta } from '@repo/shared';
import { v4 as uuidv4 } from 'uuid';

import { DatabaseService } from '../../common/database/database.service';
import { UsageEventsService } from '../admin/usage-events.service';

import { buildKeepaUsageEvents } from './keepa-projection';

export interface LogUsageParams {
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

  /**
   * Bulk variant for a whole refresh batch (up to `KEEPA_REFRESH_BATCH_SIZE`
   * ASINs): one multi-row INSERT via `unnest` instead of N sequential round
   * trips, then one `appendBatch` transaction for every entry's usage_events
   * projections combined instead of N separate transactions. IDs are
   * generated client-side so row correlation never depends on RETURNING
   * preserving VALUES order.
   */
  async logUsageBatch(entries: LogUsageParams[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const ids = entries.map(() => uuidv4());
    try {
      await this.databaseService.query(
        `INSERT INTO keepa_usage_log (id, asin, tokens, source, user_ids)
         SELECT * FROM unnest($1::uuid[], $2::varchar[], $3::numeric[], $4::varchar[], $5::jsonb[])
           AS t(id, asin, tokens, source, user_ids)`,
        [
          ids,
          entries.map((entry) => entry.asin),
          entries.map((entry) => entry.tokens),
          entries.map((entry) => entry.source),
          entries.map((entry) => JSON.stringify(entry.userIds)),
        ]
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to log Keepa usage batch (${entries.length} ASINs): ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    const events = entries.flatMap((entry, index) =>
      buildKeepaUsageEvents({
        sourceLogId: ids[index],
        tokens: entry.tokens,
        keepaSource: entry.source,
        asin: entry.asin,
        userIds: entry.userIds,
      })
    );
    if (events.length === 0) {
      return;
    }
    const results = await this.usageEventsService.appendBatch(events);
    const failed = results.filter((result) => result.failed).length;
    if (failed > 0) {
      this.logger.warn(
        `Keepa usage batch projection failed for ${failed}/${results.length} events (batch of ${entries.length} ASINs); source log retained`
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
