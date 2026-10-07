// apps/api/src/modules/ebay-returns/ebay-cancellations-actions.service.ts

import { Injectable, Logger } from '@nestjs/common';
import {
  ACTIONABLE_CANCELLATION_BUCKETS,
  CANCELLATION_ACTION_ERROR_KEY,
  CancellationActionErrorKey,
  EBAY_CANCEL_REQUESTOR_BUYER,
  EbayCancellationAction,
  EbayCancellationActionResultDto,
  PaginatedCancellationsDto,
  PlatformSettingKey,
  resolveReturnFreshnessHours,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { cancellationColumnsSql, CancellationDtoRow, toCancellationDto } from './cancellation-dto';
import { EbayCancellationRow, mapCancellation } from './cancellation-mapper';
import { EbayCancellationsSyncService } from './ebay-cancellations-sync.service';
import { RETURNS_DEFAULT_PAGE_SIZE, RETURNS_MAX_PAGE_SIZE } from './ebay-returns.constants';
import { PostOrderClient, PostOrderRejectedError } from './post-order.client';
import type { PostOrderRejectCancelRequest } from './post-order.types';
import { buildStoreScopedCancellationBucketSql } from './return-store-scope';
import { ReturnSweepScheduleService } from './return-sweep-schedule.service';

/** A refused or failed answer — the controller maps the status, the seller sees the key. */
export class CancellationActionError extends Error {
  constructor(
    readonly key: CancellationActionErrorKey,
    readonly status: 404 | 409 | 503
  ) {
    super(key);
    this.name = 'CancellationActionError';
  }
}

interface CancellationRowWithAccount {
  id: string;
  cancel_id: string;
  ebay_account_id: string;
  marketplace_id: string | null;
  /** The linked order's pushed shipment, for the reject body. */
  ebay_tracking_pushed_number: string | null;
  ebay_tracking_pushed_at: Date | null;
}

export interface CancellationListQuery {
  page?: number;
  limit?: number;
  orderId?: string;
  /** Only the requests awaiting the seller's answer. */
  actionOnly?: boolean;
}

/**
 * The seller's answer to a buyer's cancellation request, copied from
 * `EbayReturnsActionsService.act`. In this order:
 *   1. the row is the caller's,
 *   2. the operator's switch (`ebay.cancellations.actionsEnabled`, off by default),
 *   3. not suspended, not a Sandbox deployment, a marketplace on the store,
 *   4. a LIVE `GET /post-order/v2/cancellation/{cancelId}` shows a BUYER
 *      request with no `cancelCloseDate` and a `sellerResponseDueDate` —
 *      documented as returned only while a seller response is required,
 *   5. exactly ONE write, never retried (approve cancels the order and eBay
 *      refunds the buyer — a replay is not harmless),
 *   6. an `EBAY_CANCELLATION_ACTION` audit row, then a re-read into the table.
 * No enum value decides anything: `CancelStateEnum` / `CancelStatusEnum` have
 * no page in the local reference.
 */
@Injectable()
export class EbayCancellationsActionsService {
  private readonly logger = new Logger(EbayCancellationsActionsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly postOrder: PostOrderClient,
    private readonly sync: EbayCancellationsSyncService,
    private readonly schedule: ReturnSweepScheduleService
  ) {}

  /** The caller's requests, newest first — the fallback for rows not linked to an order. */
  async list(userId: string, query: CancellationListQuery): Promise<PaginatedCancellationsDto> {
    const limit = Math.min(Math.max(query.limit ?? RETURNS_DEFAULT_PAGE_SIZE, 1), RETURNS_MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const freshnessHours = resolveReturnFreshnessHours((await this.schedule.resolveCancellations()).intervalHours);
    const actionsEnabled = await this.actionsEnabled();

    const where = ['c.user_id = $1', 'c.requestor_type = $2'];
    const params: Array<string | number> = [userId, EBAY_CANCEL_REQUESTOR_BUYER];
    if (query.orderId) {
      params.push(query.orderId);
      where.push(`c.order_id = $${params.length}::uuid`);
    }
    if (query.actionOnly) {
      const bucket = buildStoreScopedCancellationBucketSql('c', freshnessHours);
      where.push(`(${bucket}) IN (${ACTIONABLE_CANCELLATION_BUCKETS.map((b) => `'${b}'`).join(', ')})`);
    }

    const count = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ebay_cancellations c WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await this.database.query<CancellationDtoRow>(
      `SELECT ${cancellationColumnsSql('c', freshnessHours)}
         FROM ebay_cancellations c
        WHERE ${where.join(' AND ')}
        ORDER BY c.requested_at DESC NULLS LAST, c.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );
    return {
      items: rows.map((row) => toCancellationDto(row, actionsEnabled)),
      total: Number(count[0]?.count ?? 0) || 0,
      page,
      limit,
    };
  }

  async act(userId: string, id: string, action: EbayCancellationAction): Promise<EbayCancellationActionResultDto> {
    const row = await this.loadRow(userId, id);
    if (!row) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.NOT_FOUND, 404);
    }
    if (!(await this.actionsEnabled())) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.ACTIONS_DISABLED, 409);
    }
    if (await this.quotaEnforcement.isSuspended(userId)) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.SUSPENDED, 409);
    }
    if (!this.postOrder.isReturnSearchSupported()) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.SANDBOX, 409);
    }
    if (!row.marketplace_id) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }
    const marketplaceId = row.marketplace_id;

    const live = await this.readLiveOrThrow(row, marketplaceId);
    this.assertOffered(live);

    const accessToken = await this.ebay.getAccountAccessToken(row.ebay_account_id);
    const rejectBody = buildRejectCancelBody(row);
    try {
      switch (action) {
        case EbayCancellationAction.APPROVE:
          await this.postOrder.approveCancellation(accessToken, marketplaceId, row.cancel_id);
          break;
        case EbayCancellationAction.REJECT:
          await this.postOrder.rejectCancellation(accessToken, marketplaceId, row.cancel_id, rejectBody);
          break;
      }
    } catch (error) {
      if (error instanceof PostOrderRejectedError) {
        await this.audit(userId, row, action, { outcome: 'rejected', httpStatus: error.status });
        throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.EBAY_REJECTED, 409);
      }
      this.logger.error(
        `Cancellation action ${action} on ${id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      await this.audit(userId, row, action, { outcome: 'failed' });
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }

    await this.audit(userId, row, action, {
      outcome: 'sent',
      withTracking: action === EbayCancellationAction.REJECT && rejectBody.trackingNumber !== undefined,
    });

    // Best-effort: what eBay says now, into the row — the order page refetches it.
    try {
      const after = await this.readLive(row, marketplaceId);
      await this.sync.upsertCancellation({ id: row.ebay_account_id, user_id: userId }, after);
    } catch (error) {
      this.logger.warn(
        `Cancellation ${id} could not be re-read after ${action}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return { action };
  }

  /** A buyer's request, still open, that eBay says needs the seller's response. */
  private assertOffered(live: EbayCancellationRow): void {
    if (live.requestorType !== EBAY_CANCEL_REQUESTOR_BUYER || live.closedAt !== null || live.sellerRespondBy === null) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.NOT_OFFERED, 409);
    }
  }

  private async actionsEnabled(): Promise<boolean> {
    return this.platformSettings.getBoolean(PlatformSettingKey.EBAY_CANCELLATIONS_ACTIONS_ENABLED);
  }

  private async readLiveOrThrow(row: CancellationRowWithAccount, marketplaceId: string): Promise<EbayCancellationRow> {
    try {
      return await this.readLive(row, marketplaceId);
    } catch (error) {
      this.logger.warn(
        `Live read of cancellation ${row.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }
  }

  private async readLive(row: CancellationRowWithAccount, marketplaceId: string): Promise<EbayCancellationRow> {
    const accessToken = await this.ebay.getAccountAccessToken(row.ebay_account_id);
    const mapped = mapCancellation(await this.postOrder.getCancellation(accessToken, marketplaceId, row.cancel_id));
    if (!mapped) {
      throw new Error('eBay cancellation detail carried no cancelId');
    }
    return mapped;
  }

  /** The caller's own row, the store's marketplace (required header) and the linked order's pushed shipment. */
  private async loadRow(userId: string, id: string): Promise<CancellationRowWithAccount | null> {
    const rows = await this.database.query<CancellationRowWithAccount>(
      `SELECT c.id, c.cancel_id, c.ebay_account_id, ea.marketplace_id,
              o.ebay_tracking_pushed_number, o.ebay_tracking_pushed_at
         FROM ebay_cancellations c
         JOIN ebay_accounts ea ON ea.id = c.ebay_account_id
         LEFT JOIN orders o ON o.id = c.order_id AND o.user_id = c.user_id
        WHERE c.user_id = $1 AND c.id = $2::uuid`,
      [userId, id]
    );
    return rows[0] ?? null;
  }

  private async audit(
    userId: string,
    row: CancellationRowWithAccount,
    action: EbayCancellationAction,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'EBAY_CANCELLATION_ACTION', 'ebay_cancellation', $2, $3)`,
        [
          userId,
          row.id,
          JSON.stringify({
            cancelId: row.cancel_id,
            ebayAccountId: row.ebay_account_id,
            action,
            ...details,
            at: new Date().toISOString(),
          }),
        ]
      );
    } catch (error) {
      this.logger.warn(
        `Audit row for cancellation ${row.id} not written: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * The reject body: the shipment we pushed to eBay (number + date) when the
 * order has one — "If the seller has shipped all or part of the order, it is
 * good practice to pass shipmentDate and trackingNumber" — else `{}`, which
 * the reference requires when neither field is sent. Pure, so a test pins it.
 */
export function buildRejectCancelBody(
  row: Pick<CancellationRowWithAccount, 'ebay_tracking_pushed_number' | 'ebay_tracking_pushed_at'>
): PostOrderRejectCancelRequest {
  const tracking = row.ebay_tracking_pushed_number?.trim();
  const shippedAt = row.ebay_tracking_pushed_at ? new Date(row.ebay_tracking_pushed_at) : null;
  if (!tracking || !shippedAt || !Number.isFinite(shippedAt.getTime())) {
    return {};
  }
  return { shipmentDate: { value: shippedAt.toISOString() }, trackingNumber: tracking };
}
