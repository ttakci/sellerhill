// apps/api/src/modules/buyer-messaging/buyer-message.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { hasMessagingScopes } from '@repo/shared';
import { DelayedError, Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';

import {
  formatCarrierForBuyer,
  greetingName,
  isSuspendedMessageExpired,
  redactForLog,
  renderTemplate,
} from './buyer-message-helpers';
import { type BuyerMessageJobData } from './buyer-message-queue.service';
import { BuyerMessagingProvider } from './buyer-message.provider';
import { BuyerMessageService } from './buyer-message.service';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGING_DEFAULTS, BUYER_MESSAGE_TOKEN } from './buyer-messaging.constants';

interface OrderCtx {
  /** Display value for `{{buyer_name}}` — the buyer's first name, or "there". */
  buyerName: string;
  /** Display value for `{{buyer_username}}` only — falls back to "there". */
  buyerUsername: string;
  /** The real eBay username the message is addressed to; null when the order has none. */
  recipientUsername: string | null;
  itemTitle: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  storeName: string;
  ebayItemId?: string;
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
    private readonly quotaEnforcement: QuotaEnforcementService,
  ) {
    super();
  }

  async process(job: Job<BuyerMessageJobData>, token?: string): Promise<void> {
    const { ebayOrderId, userId, ebayAccountId, storeId, event } = job.data;

    // 0. Silent no-op for users who haven't opted in — avoids skipped-log spam
    //    (and the idempotency query) for the common case. The per-user/per-event
    //    store_settings config is the SOLE gate; there is no env master switch.
    if (!(await this.messageService.isMessagingEnabled(userId, storeId))) {
      return;
    }

    // 0b. Suspension PARKS the message rather than dropping it. The triggers for
    //     new messages (order sync, tracking) already stop while suspended, but
    //     a message queued before the suspension — above all a feedback request
    //     delayed for days after delivery — would otherwise fire regardless.
    //     Dropping it would break "resume where it left off after payment", so
    //     it is re-parked and re-checked until the seller pays or it expires.
    if (await this.quotaEnforcement.isSuspended(userId)) {
      await this.parkWhileSuspended(job, token);
      return;
    }

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

    // 3. load context + render + send. The entire span is wrapped so a DB error
    //    from loadOrderCtx or a render bug becomes a redacted 'failed' row and
    //    rethrows for BullMQ backoff. ctx === null (order row vanished) is a
    //    legit "can't send", recorded as 'skipped' — not an error.
    let ctx: OrderCtx | null;
    try {
      ctx = await this.loadOrderCtx(ebayOrderId, ebayAccountId);
    } catch (err) {
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'failed',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        versionHash: tpl.versionHash,
        error: redactForLog((err as Error).message),
      });
      throw err;
    }
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

    // 3b. Never address a placeholder. "there" is template text; sending to it
    //     would message whichever eBay member happens to own that username.
    const recipientUsername = ctx.recipientUsername;
    if (!recipientUsername) {
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'skipped',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        error: 'no_buyer_username',
      });
      return;
    }

    // 3c. A store connected before the messaging scopes existed cannot send.
    //     eBay would refuse every attempt, so this is a permanent skip — no
    //     provider call and no BullMQ retry.
    let grantedScopes: string[] | null;
    try {
      grantedScopes = await this.loadGrantedScopes(ebayAccountId);
    } catch (err) {
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'failed',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        versionHash: tpl.versionHash,
        error: redactForLog((err as Error).message),
      });
      throw err;
    }
    if (!hasMessagingScopes(grantedScopes)) {
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'skipped',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        error: 'messaging_scope_missing',
      });
      return;
    }

    try {
      const body = renderTemplate(tpl.body, ctx);
      const result = await this.provider.sendMessage({
        ebayAccountId,
        orderId: ctx.orderId,
        ebayItemId: ctx.ebayItemId,
        buyerUsername: recipientUsername,
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
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'failed',
        templateKind: tpl.kind,
        templateRef: tpl.ref,
        versionHash: tpl.versionHash,
        error: redactForLog((err as Error).message),
      });
      throw err; // BullMQ backoff retries; final failure leaves 'failed'.
    }
  }

  /**
   * Load buyer/item/tracking context via orders -> listings -> products join.
   * Schema (verified against migrations 012/022/024/010/075/089/111):
   *   - `{{tracking_number}}` is orders.ebay_tracking_pushed_number (089) — the
   *     number eBay RECEIVED — and nothing else. The supplier's own number
   *     (orders.amazon_tracking_number) must never be rendered into a message:
   *     a seller pays for the conversion precisely so the buyer never sees it.
   *     No pushed number → the token is empty and its line is dropped.
   *   - `{{carrier}}` is the carrier that pushed number went out under: the
   *     converted carrier when the pushed number is the converted one (075),
   *     the Amazon carrier when the seller chose no conversion and the raw
   *     number is what eBay holds, otherwise unknown (a fulfillment found
   *     already on eBay) and left empty.
   *   - `{{buyer_name}}` comes from orders.buyer_name, then the ship-to name.
   *   - ebay_accounts.store_name (migration 022, nullable), ebay_accounts.seller_id (migration 002)
   *   - listings.ebay_item_id (migration 010; nullable for drafts since 032) - the
   *     persistent eBay item id pointer; we use it directly instead of digging
   *     through transient eBay line_items JSON, which is never persisted.
   *   - orders.ebay_legacy_item_id (migration 111) - the eBay item id an order
   *     was ingested against even when it matched no listing at the time. An
   *     order adopted by a listing imported LATER has `l.ebay_item_id` too, so
   *     the listing's own column is preferred and the order's is the fallback
   *     for an order that is still untracked.
   *   - orders has NO line_items column.
   */
  private async loadOrderCtx(ebayOrderId: string, ebayAccountId: string): Promise<OrderCtx | null> {
    const rows = await this.db.query<{
      buyer_username: string | null;
      buyer_name: string | null;
      item_title: string;
      order_id: string;
      tracking_number: string | null;
      carrier: string | null;
      store_name: string | null;
      legacy_item_id: string | null;
    }>(
      `SELECT o.buyer_username,
              COALESCE(NULLIF(o.buyer_name, ''), o.shipping_address->>'fullName') AS buyer_name,
              COALESCE(p.title, o.ebay_order_id) AS item_title,
              o.ebay_order_id AS order_id,
              o.ebay_tracking_pushed_number AS tracking_number,
              CASE
                WHEN o.ebay_tracking_pushed_number IS NULL THEN NULL
                WHEN o.ebay_tracking_pushed_number = o.converted_tracking_number THEN o.converted_tracking_carrier
                WHEN o.ebay_tracking_pushed_number = o.amazon_tracking_number THEN o.amazon_tracking_carrier
                ELSE NULL
              END AS carrier,
              -- Never seller_id: since migration 108 it is eBay's opaque immutable
              -- user id, and this value reaches buyers through {{store_name}}.
              COALESCE(NULLIF(ea.store_name, ''), ea.ebay_username) AS store_name,
              COALESCE(l.ebay_item_id, o.ebay_legacy_item_id) AS legacy_item_id
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN products p ON p.id = l.product_id
         LEFT JOIN ebay_accounts ea ON ea.id = o.ebay_account_id
        WHERE o.ebay_order_id = $1 AND o.ebay_account_id = $2
        LIMIT 1`,
      [ebayOrderId, ebayAccountId],
    );
    if (!rows[0]) {
      return null;
    }
    const r = rows[0];
    const recipientUsername = r.buyer_username?.trim() || null;
    return {
      buyerName: greetingName(r.buyer_name),
      buyerUsername: recipientUsername ?? 'there',
      recipientUsername,
      itemTitle: r.item_title,
      orderId: r.order_id,
      trackingNumber: r.tracking_number?.trim() || undefined,
      carrier: formatCarrierForBuyer(r.carrier),
      storeName: r.store_name || 'our store',
      ebayItemId: r.legacy_item_id ?? undefined,
    };
  }

  /** The scopes the store was granted at its last consent (migration 125). */
  private async loadGrantedScopes(ebayAccountId: string): Promise<string[] | null> {
    const rows = await this.db.query<{ granted_scopes: string[] | null }>(
      'SELECT granted_scopes FROM ebay_accounts WHERE id = $1',
      [ebayAccountId],
    );
    return rows[0]?.granted_scopes ?? null;
  }

  /**
   * Re-park a message whose sender is suspended, or retire it once it has
   * waited too long. Uses the same `moveToDelayed` + `DelayedError` pattern as
   * the listing worker's eBay-budget deferral, so a parked message never
   * consumes one of its BullMQ attempts — a suspension is not a send failure.
   */
  private async parkWhileSuspended(job: Job<BuyerMessageJobData>, token?: string): Promise<void> {
    const { ebayOrderId, userId, ebayAccountId, event } = job.data;

    if (
      isSuspendedMessageExpired(
        job.timestamp,
        job.opts.delay,
        Date.now(),
        BUYER_MESSAGING_DEFAULTS.SUSPENDED_MAX_AGE_MS,
      )
    ) {
      this.logger.log(
        `Buyer message ${event} for ${ebayOrderId} expired while suspended — not sending`,
      );
      await this.recordLog({
        ebayOrderId,
        userId,
        ebayAccountId,
        event,
        status: 'skipped',
        templateKind: 'system',
        templateRef: 'suspended-expired',
      });
      return;
    }

    if (!token) {
      // Without a worker token the job cannot be re-parked. Ending here would
      // drop it silently, so hand it to BullMQ's retry instead.
      throw new Error(`Buyer message ${event} for ${ebayOrderId} parked: subscription suspended`);
    }

    this.logger.log(
      `Buyer message ${event} for ${ebayOrderId} parked: subscription suspended`,
    );
    await job.moveToDelayed(Date.now() + BUYER_MESSAGING_DEFAULTS.SUSPENDED_DEFER_MS, token);
    throw new DelayedError();
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
      // `$7` is used twice, so it carries an explicit cast both times: left
      // bare, Postgres deduces the enum from the column and text from the
      // comparison and refuses the statement — which is how this ledger stayed
      // empty (and the "already sent?" guard blind) until 2026-10-02.
      await this.db.query(
        `INSERT INTO buyer_message_log
           (user_id, ebay_account_id, ebay_order_id, event_type, template_kind, template_ref, status, error, provider_message_id, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::buyer_message_status,$8,$9,
                 CASE WHEN $7::buyer_message_status = 'sent' THEN NOW() ELSE NULL END)`,
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
      // Best-effort, but only a concurrent 'sent' (unique violation) is
      // expected. Anything else means the idempotency ledger is not being
      // written, and that must be visible.
      if ((err as { code?: string }).code === '23505') {
        this.logger.debug(`log write skipped: ${(err as Error).message}`);
      } else {
        this.logger.warn(`buyer_message_log write FAILED for ${args.ebayOrderId}/${args.event}: ${(err as Error).message}`);
      }
    }
  }
}
