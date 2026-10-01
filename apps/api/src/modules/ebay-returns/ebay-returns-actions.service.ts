// apps/api/src/modules/ebay-returns/ebay-returns-actions.service.ts

import { Injectable, Logger } from '@nestjs/common';
import {
  deriveReturnBucket,
  EbayReturnAction,
  EbayReturnActionResultDto,
  EbayReturnDetailDto,
  EbayReturnDto,
  PlatformSettingKey,
  resolveReturnActions,
  resolveReturnFreshnessHours,
  RETURN_ACTION_EBAY_OPTION,
  RETURN_ACTION_ERROR_KEY,
  ReturnActionErrorKey,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { EbayReturnsSyncService } from './ebay-returns-sync.service';
import { EbayReturnsService } from './ebay-returns.service';
import { PostOrderClient, PostOrderRejectedError } from './post-order.client';
import type { PostOrderIssueRefundRequest, PostOrderReturnDetail } from './post-order.types';
import { mapReturnDetail, type MappedReturnDetail } from './return-detail-mapper';
import { ReturnSweepScheduleService } from './return-sweep-schedule.service';

/** A refused or failed action — the controller maps the status, the seller sees the key. */
export class ReturnActionError extends Error {
  constructor(
    readonly key: ReturnActionErrorKey,
    readonly status: 404 | 409 | 503
  ) {
    super(key);
    this.name = 'ReturnActionError';
  }
}

/**
 * `RefundFeeTypeEnum` value for the one refund line sent: the purchase price.
 * The enum's page is not in the local eBay reference; `PURCHASE_PRICE` is the
 * value the issue_refund page's own sample uses. The total is eBay's own
 * `sellerTotalRefund.estimatedRefundAmount` — the amount eBay computed for
 * this return, never a figure typed here.
 */
export const REFUND_FEE_TYPE_PURCHASE_PRICE = 'PURCHASE_PRICE';

interface ReturnRowWithAccount {
  id: string;
  return_id: string;
  ebay_account_id: string;
  marketplace_id: string | null;
}

/** A live detail read is reused for this long, so opening a pane twice costs one call. */
const DETAIL_CACHE_MS = 60_000;

/**
 * The seller's own actions on a return — the detail pane's live read and the
 * three in-app actions. Every write goes through `act`, which in this order:
 *   1. checks the operator's switch (`ebay.returns.actionsEnabled`, off by default),
 *   2. refuses a suspended account and a Sandbox deployment,
 *   3. reads the return LIVE from eBay and requires the matching
 *      `sellerAvailableOptions` entry — the stored row may be hours old,
 *   4. sends exactly one Post-Order call, never retried,
 *   5. writes an `audit_logs` row and re-reads the return into `ebay_returns`.
 * Nothing is inferred: an action eBay does not list is a 409, never a try.
 */
@Injectable()
export class EbayReturnsActionsService {
  private readonly logger = new Logger(EbayReturnsActionsService.name);
  private readonly detailCache = new Map<string, { at: number; value: MappedReturnDetail }>();

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly postOrder: PostOrderClient,
    private readonly returns: EbayReturnsService,
    private readonly sync: EbayReturnsSyncService,
    private readonly schedule: ReturnSweepScheduleService
  ) {}

  /** The stored row plus a live read; the live half is empty (and `live` false) when eBay cannot be read. */
  async detail(userId: string, id: string): Promise<EbayReturnDetailDto> {
    const stored = await this.returns.findOne(userId, id);
    if (!stored) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.NOT_FOUND, 404);
    }
    const actionsEnabled = await this.actionsEnabled();

    let live: MappedReturnDetail | null = null;
    if (this.postOrder.isReturnSearchSupported()) {
      try {
        live = await this.readLive(userId, id, false);
      } catch (error) {
        this.logger.warn(`Live read of return ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return this.toDetailDto(stored, live, actionsEnabled);
  }

  async act(userId: string, id: string, action: EbayReturnAction): Promise<EbayReturnActionResultDto> {
    const row = await this.loadRow(userId, id);
    if (!row) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.NOT_FOUND, 404);
    }
    if (!(await this.actionsEnabled())) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.ACTIONS_DISABLED, 409);
    }
    if (await this.quotaEnforcement.isSuspended(userId)) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.SUSPENDED, 409);
    }
    if (!this.postOrder.isReturnSearchSupported()) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.SANDBOX, 409);
    }
    if (!row.marketplace_id) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }

    // Fresh, never the cache: the option list decides whether money moves.
    const live = await this.readLiveOrThrow(userId, id, true);
    this.assertOffered(live, action);

    const accessToken = await this.ebay.getAccountAccessToken(row.ebay_account_id);
    const marketplaceId = row.marketplace_id;
    let refundStatus: string | null = null;
    try {
      switch (action) {
        case EbayReturnAction.APPROVE: {
          const answer = await this.postOrder.decideReturn(accessToken, marketplaceId, row.return_id, {
            decision: 'APPROVE',
          });
          refundStatus = answer.refundStatus ?? null;
          break;
        }
        case EbayReturnAction.MARK_RECEIVED:
          await this.postOrder.markReturnReceived(accessToken, marketplaceId, row.return_id, {});
          break;
        case EbayReturnAction.ISSUE_REFUND: {
          const answer = await this.postOrder.issueReturnRefund(
            accessToken,
            marketplaceId,
            row.return_id,
            buildFullRefundBody(live)
          );
          refundStatus = answer.refundStatus ?? null;
          break;
        }
      }
    } catch (error) {
      if (error instanceof ReturnActionError) {
        throw error;
      }
      if (error instanceof PostOrderRejectedError) {
        await this.audit(userId, row, action, { outcome: 'rejected', httpStatus: error.status });
        throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.EBAY_REJECTED, 409);
      }
      this.logger.error(`Return action ${action} on ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
      await this.audit(userId, row, action, { outcome: 'failed' });
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }

    await this.audit(userId, row, action, {
      outcome: 'sent',
      refundStatus,
      amount: action === EbayReturnAction.ISSUE_REFUND ? live.row.estimatedRefundAmount : null,
      currency: action === EbayReturnAction.ISSUE_REFUND ? live.row.currency : null,
    });

    // Best-effort: what eBay says now, into the row — the page refetches it.
    this.detailCache.delete(id);
    try {
      const after = await this.readLive(userId, id, true);
      await this.sync.upsertReturn({ id: row.ebay_account_id, user_id: userId }, after.row);
    } catch (error) {
      this.logger.warn(`Return ${id} could not be re-read after ${action}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { action, refundStatus };
  }

  private assertOffered(live: MappedReturnDetail, action: EbayReturnAction): void {
    if (!live.options.includes(RETURN_ACTION_EBAY_OPTION[action])) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.NOT_OFFERED, 409);
    }
    if (action === EbayReturnAction.ISSUE_REFUND && !(Number(live.row.estimatedRefundAmount) > 0 && live.row.currency)) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.REFUND_AMOUNT_UNKNOWN, 409);
    }
  }

  private async actionsEnabled(): Promise<boolean> {
    return this.platformSettings.getBoolean(PlatformSettingKey.EBAY_RETURNS_ACTIONS_ENABLED);
  }

  private async readLiveOrThrow(userId: string, id: string, fresh: boolean): Promise<MappedReturnDetail> {
    try {
      return await this.readLive(userId, id, fresh);
    } catch (error) {
      if (error instanceof ReturnActionError) {
        throw error;
      }
      this.logger.warn(`Live read of return ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }
  }

  private async readLive(userId: string, id: string, fresh: boolean): Promise<MappedReturnDetail> {
    const cached = this.detailCache.get(id);
    if (!fresh && cached && Date.now() - cached.at < DETAIL_CACHE_MS) {
      return cached.value;
    }
    const row = await this.loadRow(userId, id);
    if (!row) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.NOT_FOUND, 404);
    }
    if (!row.marketplace_id) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }
    const accessToken = await this.ebay.getAccountAccessToken(row.ebay_account_id);
    const detail: PostOrderReturnDetail = await this.postOrder.getReturn(accessToken, row.marketplace_id, row.return_id);
    const mapped = mapReturnDetail(detail);
    if (!mapped) {
      throw new ReturnActionError(RETURN_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }
    this.detailCache.set(id, { at: Date.now(), value: mapped });
    return mapped;
  }

  /** The caller's own row, with the store's marketplace (the required Post-Order header). */
  private async loadRow(userId: string, id: string): Promise<ReturnRowWithAccount | null> {
    const rows = await this.database.query<ReturnRowWithAccount>(
      `SELECT r.id, r.return_id, r.ebay_account_id, ea.marketplace_id
         FROM ebay_returns r
         JOIN ebay_accounts ea ON ea.id = r.ebay_account_id
        WHERE r.user_id = $1 AND r.id = $2::uuid`,
      [userId, id]
    );
    return rows[0] ?? null;
  }

  private async audit(
    userId: string,
    row: ReturnRowWithAccount,
    action: EbayReturnAction,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'EBAY_RETURN_ACTION', 'ebay_return', $2, $3)`,
        [
          userId,
          row.id,
          JSON.stringify({ returnId: row.return_id, ebayAccountId: row.ebay_account_id, action, ...details, at: new Date().toISOString() }),
        ],
      );
    } catch (error) {
      // Bookkeeping must never turn a sent action into a seller-visible error.
      this.logger.warn(`Audit row for return ${row.id} not written: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async toDetailDto(
    stored: EbayReturnDto,
    live: MappedReturnDetail | null,
    actionsEnabled: boolean
  ): Promise<EbayReturnDetailDto> {
    if (!live) {
      return {
        ...stored,
        live: false,
        actionsEnabled,
        availableActions: [],
        ebayOptions: [],
        ebayUrl: null,
        history: [],
        shipments: [],
        returnType: null,
        itemPrice: null,
        closeReason: null,
        closedAt: null,
      };
    }
    const now = new Date();
    const freshnessHours = resolveReturnFreshnessHours((await this.schedule.resolve()).intervalHours);
    const { row } = live;
    return {
      ...stored,
      // The live read outranks the stored row for everything eBay just said.
      state: row.state,
      status: row.status,
      reason: row.reason,
      reasonType: row.reasonType,
      sellerActivityDue: row.sellerActivityDue,
      sellerRespondBy: row.sellerRespondBy,
      estimatedRefundAmount: row.estimatedRefundAmount,
      actualRefundAmount: row.actualRefundAmount,
      currency: row.currency ?? stored.currency,
      bucket: deriveReturnBucket(
        {
          state: row.state,
          status: row.status,
          sellerActivityDue: row.sellerActivityDue,
          sellerRespondBy: row.sellerRespondBy,
          lastSyncedAt: now,
        },
        now,
        freshnessHours
      ),
      lastSyncedAt: now.toISOString(),
      live: true,
      actionsEnabled,
      availableActions: resolveReturnActions(live.options, actionsEnabled),
      ebayOptions: live.options,
      ebayUrl: live.actionUrl,
      history: live.history,
      shipments: live.shipments,
      returnType: live.returnType,
      itemPrice: live.itemPrice,
      closeReason: live.closeReason,
      closedAt: live.closedAt,
    };
  }
}

/**
 * The full refund eBay computed, as one purchase-price line whose total
 * equals it — the documented shape ("totalAmount should equal the sum of the
 * itemizedRefundDetail amounts"). Pure, so a test can pin the body.
 */
export function buildFullRefundBody(live: MappedReturnDetail): PostOrderIssueRefundRequest {
  const value = Number(live.row.estimatedRefundAmount);
  const currency = live.row.currency ?? '';
  return {
    refundDetail: {
      itemizedRefundDetail: [{ refundAmount: { value, currency }, refundFeeType: REFUND_FEE_TYPE_PURCHASE_PRICE }],
      totalAmount: { value, currency },
    },
  };
}
