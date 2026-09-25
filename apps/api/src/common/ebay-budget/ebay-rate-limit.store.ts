import { Injectable, Logger } from '@nestjs/common';
import type { EbayRateLimitResourceDto } from '@repo/shared';

import { DatabaseService } from '../database/database.service';

import { mapRateLimits, type MappedRateLimits } from './ebay-rate-limits';

/** How long a replica trusts its in-memory snapshot before re-reading the row another replica may have refreshed. */
export const STORE_MEMORY_TTL_MS = 60_000;

export interface EbayRateLimitSnapshot {
  resources: EbayRateLimitResourceDto[];
  fetchedAt: Date;
  mapped: MappedRateLimits;
}

/**
 * The last limits eBay reported, persisted.
 *
 * The governor reads this on every acquire, so it is served from memory and
 * the mapping is computed once per snapshot. A failed database read keeps the
 * previous value (spec D2: the last value eBay gave always applies).
 */
@Injectable()
export class EbayRateLimitStore {
  private readonly logger = new Logger(EbayRateLimitStore.name);
  private snapshot: EbayRateLimitSnapshot | null = null;
  private loadedAt = 0;

  constructor(private readonly database: DatabaseService) {}

  async save(resources: EbayRateLimitResourceDto[], fetchedAt: Date): Promise<void> {
    // An empty answer is not evidence that eBay stopped metering — storing it
    // would remove every ceiling at once.
    if (resources.length === 0) {
      return;
    }
    await this.database.query(
      `INSERT INTO ebay_rate_limits (id, resources, fetched_at)
       VALUES (1, $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET resources = EXCLUDED.resources, fetched_at = EXCLUDED.fetched_at`,
      [JSON.stringify(resources), fetchedAt.toISOString()],
    );
    this.snapshot = { resources, fetchedAt, mapped: mapRateLimits(resources) };
    this.loadedAt = Date.now();
  }

  async current(): Promise<EbayRateLimitSnapshot | null> {
    if (this.loadedAt > 0 && Date.now() - this.loadedAt < STORE_MEMORY_TTL_MS) {
      return this.snapshot;
    }
    try {
      const rows = await this.database.query<{ resources: EbayRateLimitResourceDto[]; fetched_at: Date }>(
        'SELECT resources, fetched_at FROM ebay_rate_limits WHERE id = 1',
        [],
      );
      const row = rows[0];
      if (row && Array.isArray(row.resources)) {
        this.snapshot = { resources: row.resources, fetchedAt: new Date(row.fetched_at), mapped: mapRateLimits(row.resources) };
      }
      this.loadedAt = Date.now();
    } catch (error: unknown) {
      this.logger.warn(
        `Could not read stored eBay rate limits, keeping the last known value: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return this.snapshot;
  }
}
