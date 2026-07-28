// apps/api/src/modules/buyer-messaging/buyer-message.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';

import { renderTemplate } from './buyer-message-helpers';
import { BuyerMessageQueueService, type BuyerMessageJobData } from './buyer-message-queue.service';
import { BuyerMessagingProvider } from './buyer-message.provider';
import { BuyerMessageService } from './buyer-message.service';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGING_DEFAULTS, BUYER_MESSAGE_TOKEN } from './buyer-messaging.constants';

interface OrderCtx {
  buyerUsername: string;
  itemTitle: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  storeName: string;
  lineItemId?: string;
}

/**
 * Worker for the buyer-message queue. Idempotent (guarded by buyer_message_log
 * unique-on-sent) and fail-soft (enqueue never throws; send errors become
 * 'failed' log rows then rethrow for BullMQ backoff). Re-checks template
 * config at fire time so a disabled event never sends.
 */
@Processor(BUYER_MESSAGE_QUEUE, { concurrency: BUYER_MESSAGING_DEFAULTS.QUEUE_CONCURRENCY })
@Injectable()
export class BuyerMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(BuyerMessageProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly messageService: BuyerMessageService,
    @Inject(BUYER_MESSAGE_TOKEN) private readonly provider: BuyerMessagingProvider,
    private readonly queue: BuyerMessageQueueService,
  ) {
    super();
  }

  async process(job: Job<BuyerMessageJobData>): Promise<void> {
    const { ebayOrderId, userId, ebayAccountId, storeId, event } = job.data;

    // 1. idempotency guard — already sent?
    const already = await this.db.query<{ id: string }>(
      `SELECT id FROM buyer_message_log WHERE ebay_order_id=$1 AND event_type=$2 AND status='sent' LIMIT 1`,
      [ebayOrderId, event],
    );
    if (already.length) {
      return;
    }

    // 2. resolve template (null => disabled/unconfigured) — re-checks config at fire time.
    const tpl = await this.messageService.resolveTemplate(userId, storeId, event);
    if (!tpl) {
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'skipped',
        templateKind: 'system',
        templateRef: 'none',
      });
      return;
    }

    // 3. feedback_request scheduling: producer-side delay handles when the job fires;
    //    here we just send once it has fired.
    const ctx = await this.loadOrderCtx(ebayOrderId, ebayAccountId);
    if (!ctx) {
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'skipped',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
      });
      return;
    }
    const body = renderTemplate(tpl.body, ctx);

    // 4. send
    try {
      const result = await this.provider.sendMessage({
        ebayAccountId,
        orderId: ctx.orderId,
        lineItemId: ctx.lineItemId,
        buyerUsername: ctx.buyerUsername,
        body,
      });
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'sent',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        versionHash: tpl.versionHash,
        providerMessageId: result.providerMessageId,
      });
    } catch (err) {
      const redacted = String((err as Error).message)
        .replace(/Bearer\s+[\w.-]+/gi, '[redacted]')
        .slice(0, 400);
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'failed',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        versionHash: tpl.versionHash,
        error: redacted,
      });
      throw err; // BullMQ backoff retries; final failure leaves 'failed'.
    }
  }

  /** Load buyer/item/tracking context via orders→listings→products join. */
  private async loadOrderCtx(ebayOrderId: string, ebayAccountId: string): Promise<OrderCtx | null> {
    const rows = await this.db.query<{
      buyer_username: string;
      item_title: string;
      order_id: string;
      tracking_number: string | null;
      carrier: string | null;
      store_name: string;
      legacy_item_id: string | null;
    }>(
      `SELECT o.buyer_username, COALESCE(p.title, o.ebay_order_id) AS item_title,
              o.ebay_order_id AS order_id, o.tracking_number, o.carrier,
              ea.seller_id AS store_name, li.legacy_item_id
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN products p ON p.id = l.product_id
         LEFT JOIN ebay_accounts ea ON ea.id = o.ebay_account_id
         LEFT JOIN LATERAL (
           SELECT jsonb_array_elements(o.line_items)->>'legacyItemId' AS legacy_item_id LIMIT 1
         ) li ON true
        WHERE o.ebay_order_id = $1 AND o.ebay_account_id = $2
        LIMIT 1`,
      [ebayOrderId, ebayAccountId],
    );
    if (!rows[0]) {
      return null;
    }
    const r = rows[0];
    // Note: LocalTrackingConverter only exposes `convert(rawNumber, rawCarrier)`
    // returning eBay-specific enum codes (e.g. 'Amazon_Logistics', 'UPS') — those
    // aren't useful for a buyer-facing {{carrier}} placeholder, so we passthrough
    // the raw carrier string as recorded on the order. {{carrier}} is a nice-to-have,
    // not load-bearing.
    return {
      buyerUsername: r.buyer_username || 'there',
      itemTitle: r.item_title,
      orderId: r.order_id,
      trackingNumber: r.tracking_number ?? undefined,
      carrier: r.carrier ?? undefined,
      storeName: r.store_name || 'our store',
      lineItemId: r.legacy_item_id ?? undefined,
    };
  }

  private async recordLog(args: {
    ebayOrderId: string;
    userId: string;
    ebayAccountId: string;
    event: string;
    status: 'sent' | 'failed' | 'skipped';
    templateKind: string;
    templateRef: string;
    versionHash?: string;
    providerMessageId?: string;
    error?: string;
  }): Promise<void> {
    const ref = args.versionHash ? `${args.templateRef}@${args.versionHash}` : args.templateRef;
    try {
      await this.db.query(
        `INSERT INTO buyer_message_log
           (user_id, ebay_account_id, ebay_order_id, event_type, template_kind, template_ref, status, error, provider_message_id, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $7='sent' THEN NOW() ELSE NULL END)`,
        [
          args.userId,
          args.ebayAccountId,
          args.ebayOrderId,
          args.event,
          args.templateKind,
          ref,
          args.status,
          args.error ?? null,
          args.providerMessageId ?? null,
        ],
      );
    } catch (err) {
      // logging is best-effort; concurrent sent unique-violation is expected and fine.
      this.logger.debug(`log write skipped: ${(err as Error).message}`);
    }
  }
}
