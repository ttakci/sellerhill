import { Injectable, Logger } from '@nestjs/common';
import type { AutoFulfillEvent } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { getCorrelation } from '../../common/observability/correlation.context';

/** Scalars only: figures, codes and flags. See `record`. */
export type AutoFulfillEventDetail = Record<string, string | number | boolean | null | undefined>;

export interface AutoFulfillEventContext {
  userId?: string | null;
  amazonAccountId?: string | null;
  detail?: AutoFulfillEventDetail;
}

/**
 * Append-only audit trail of automatic Amazon purchases (`auto_fulfill_events`,
 * migration 132): which step ran for which order, on which buyer account, with
 * which totals. It exists to answer "what did the automation do with this
 * order's money" after the fact — a duplicate, a missing purchase, a block
 * nobody understands.
 *
 * Two rules:
 *  - NEVER THROWS. A failed insert is logged and swallowed; the trail must not
 *    be able to change the outcome of a purchase, least of all after the click.
 *  - NO BUYER DATA. `detail` carries figures and codes only — never a name, an
 *    address or page content — so the eBay account-deletion erasure does not
 *    have to reach this table.
 *
 * Nothing reads it back to decide anything: the click boundary is
 * `orders.auto_fulfill_submitted_at`.
 */
@Injectable()
export class AutoFulfillEventLog {
  private readonly logger = new Logger(AutoFulfillEventLog.name);

  constructor(private readonly db: DatabaseService) {}

  async record(ebayOrderId: string, event: AutoFulfillEvent, context: AutoFulfillEventContext = {}): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO auto_fulfill_events (ebay_order_id, user_id, amazon_account_id, event, detail, correlation_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          ebayOrderId,
          context.userId ?? null,
          context.amazonAccountId ?? null,
          event,
          context.detail ? JSON.stringify(context.detail) : null,
          getCorrelation().correlationId ?? null,
        ]
      );
    } catch (err) {
      this.logger.warn(`auto-fulfill event ${event} for ${ebayOrderId} not recorded: ${(err as Error).message}`);
    }
  }
}
