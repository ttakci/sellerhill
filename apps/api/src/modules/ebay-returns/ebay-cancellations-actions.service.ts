// apps/api/src/modules/ebay-returns/ebay-cancellations-actions.service.ts

import { Injectable, Logger } from '@nestjs/common';
import {
  ACTIONABLE_CANCELLATION_BUCKETS,
  buildEbayCancellationUrl,
  CANCELLATION_ACTION_ERROR_KEY,
  CANCELLATION_TABS,
  CancellationActionErrorKey,
  CancellationBucket,
  CancellationBucketCountsDto,
  CancellationsQueryDto,
  CancellationTab,
  deriveCancellationBucket,
  EBAY_CANCEL_REQUESTOR_BUYER,
  EbayCancellationAction,
  EbayCancellationActionResultDto,
  EbayCancellationDetailDto,
  EbayCancellationDto,
  EbayEnvironment,
  PaginatedCancellationsDto,
  PlatformSettingKey,
  resolveReturnFreshnessHours,
} from '@repo/shared';

import { DatabaseService, QueryParam } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import {
  CANCELLATION_PRODUCT_COLUMNS_SQL,
  cancellationColumnsSql,
  CancellationDtoRow,
  toCancellationDto,
} from './cancellation-dto';
import { EbayCancellationRow, MappedCancellationDetail, mapCancellationDetail } from './cancellation-mapper';
import { EbayCancellationsSyncService } from './ebay-cancellations-sync.service';
import { clampLimit, clampPage, escapeLike, productJoinsSql } from './ebay-returns.service';
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

/** A live detail read is reused for this long, so opening the drawer twice costs one call. */
const DETAIL_CACHE_MS = 60_000;

const CANCELLATION_BUCKETS = new Set<string>(Object.values(CancellationBucket));

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
  private readonly detailCache = new Map<string, { at: number; value: MappedCancellationDetail }>();

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly postOrder: PostOrderClient,
    private readonly sync: EbayCancellationsSyncService,
    private readonly schedule: ReturnSweepScheduleService
  ) {}

  /**
   * The store-scoped bucket CASE over `c`, with the horizon of the cancellation
   * sweep's actual interval, and the operator switch — read per request.
   */
  private async listContext(): Promise<{ bucketSql: string; freshnessHours: number; actionsEnabled: boolean }> {
    const freshnessHours = resolveReturnFreshnessHours((await this.schedule.resolveCancellations()).intervalHours);
    return {
      bucketSql: buildStoreScopedCancellationBucketSql('c', freshnessHours),
      freshnessHours,
      actionsEnabled: await this.actionsEnabled(),
    };
  }

  /**
   * The caller's BUYER requests — the ones awaiting an answer first, soonest
   * deadline first, then newest — with the linked order's product. The
   * `EbayReturnsService.list` shape.
   */
  async list(userId: string, query: CancellationsQueryDto = {}): Promise<PaginatedCancellationsDto> {
    const page = clampPage(query.page);
    const limit = clampLimit(query.limit);
    const { bucketSql, freshnessHours, actionsEnabled } = await this.listContext();

    const where = ['c.user_id = $1', 'c.requestor_type = $2'];
    const params: QueryParam[] = [userId, EBAY_CANCEL_REQUESTOR_BUYER];
    if (query.tab && query.tab !== CancellationTab.ALL) {
      params.push([...CANCELLATION_TABS[query.tab]]);
      where.push(`${bucketSql} = ANY($${params.length}::text[])`);
    }
    if (query.ebayAccountId) {
      params.push(query.ebayAccountId);
      where.push(`c.ebay_account_id = $${params.length}::uuid`);
    }
    if (query.orderId) {
      params.push(query.orderId);
      where.push(`c.order_id = $${params.length}::uuid`);
    }
    const search = query.search?.trim();
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      const term = `$${params.length}`;
      where.push(`(c.cancel_id ILIKE ${term} OR c.legacy_order_id ILIKE ${term} OR l.title ILIKE ${term})`);
    }

    // Same joins as the page, so a title search counts exactly the rows listed; none can multiply a row.
    const count = await this.database.query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
         FROM ebay_cancellations c
       ${productJoinsSql('c')}
        WHERE ${where.join(' AND ')}`,
      params
    );
    const actionableIndex = params.length + 1;
    const rows = await this.database.query<CancellationDtoRow>(
      `SELECT ${cancellationColumnsSql('c', freshnessHours)}, ${CANCELLATION_PRODUCT_COLUMNS_SQL}
         FROM ebay_cancellations c
       ${productJoinsSql('c')}
        WHERE ${where.join(' AND ')}
        ORDER BY CASE WHEN ${bucketSql} = ANY($${actionableIndex}::text[]) THEN 0 ELSE 1 END,
                 c.seller_respond_by ASC NULLS LAST,
                 c.requested_at DESC NULLS LAST,
                 c.id ASC
        LIMIT $${actionableIndex + 1} OFFSET $${actionableIndex + 2}`,
      [...params, [...ACTIONABLE_CANCELLATION_BUCKETS], limit, (page - 1) * limit]
    );
    return {
      items: rows.map((row) => toCancellationDto(row, actionsEnabled)),
      total: Number(count[0]?.count ?? 0) || 0,
      page,
      limit,
    };
  }

  /** How many of the caller's BUYER requests sit in each bucket — every bucket present, zero-filled. */
  async counts(userId: string, filter: { ebayAccountId?: string } = {}): Promise<CancellationBucketCountsDto> {
    const { bucketSql } = await this.listContext();
    const where = ['c.user_id = $1', 'c.requestor_type = $2'];
    const params: QueryParam[] = [userId, EBAY_CANCEL_REQUESTOR_BUYER];
    if (filter.ebayAccountId) {
      params.push(filter.ebayAccountId);
      where.push(`c.ebay_account_id = $${params.length}::uuid`);
    }
    const rows = await this.database.query<{ bucket: string; count: number | string }>(
      `SELECT ${bucketSql} AS bucket, COUNT(*)::int AS count
         FROM ebay_cancellations c
        WHERE ${where.join(' AND ')}
        GROUP BY 1`,
      params
    );
    const counts = Object.fromEntries(
      Object.values(CancellationBucket).map((bucket) => [bucket, 0])
    ) as CancellationBucketCountsDto;
    for (const row of rows) {
      if (CANCELLATION_BUCKETS.has(row.bucket)) {
        counts[row.bucket as CancellationBucket] = Number(row.count) || 0;
      }
    }
    return counts;
  }

  /**
   * The stored row plus ONE live read (reused for `DETAIL_CACHE_MS`). The
   * answers offered come from the LIVE request and the switch; when eBay
   * cannot be read the stored row comes back with `live: false` and no answer.
   */
  async detail(userId: string, id: string): Promise<EbayCancellationDetailDto> {
    const { freshnessHours, actionsEnabled } = await this.listContext();
    const rows = await this.database.query<CancellationDtoRow>(
      `SELECT ${cancellationColumnsSql('c', freshnessHours)}, ${CANCELLATION_PRODUCT_COLUMNS_SQL}
         FROM ebay_cancellations c
       ${productJoinsSql('c')}
        WHERE c.user_id = $1 AND c.id = $2::uuid`,
      [userId, id]
    );
    if (!rows[0]) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.NOT_FOUND, 404);
    }
    const stored = toCancellationDto(rows[0], actionsEnabled);
    // Post-Order has no Sandbox, so "supported" is exactly "production keys".
    const supported = this.postOrder.isReturnSearchSupported();
    const ebayUrl = buildEbayCancellationUrl(
      stored.cancelId,
      supported ? EbayEnvironment.PRODUCTION : EbayEnvironment.SANDBOX
    );

    let live: MappedCancellationDetail | null = null;
    if (supported) {
      try {
        const row = await this.loadRow(userId, id);
        if (row?.marketplace_id) {
          live = await this.readLive(row, row.marketplace_id, false);
        }
      } catch (error) {
        this.logger.warn(
          `Live read of cancellation ${id} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return toCancellationDetailDto(stored, live, actionsEnabled, freshnessHours, ebayUrl);
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

    // Fresh, never the cache: the live request decides whether the order is cancelled.
    const live = await this.readLiveOrThrow(row, marketplaceId);
    this.assertOffered(live.row);

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

    // Best-effort: what eBay says now, into the row (and the drawer's cache) — the pages refetch it.
    this.detailCache.delete(row.id);
    try {
      const after = await this.readLive(row, marketplaceId, true);
      await this.sync.upsertCancellation({ id: row.ebay_account_id, user_id: userId }, after.row);
    } catch (error) {
      this.logger.warn(
        `Cancellation ${id} could not be re-read after ${action}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return { action };
  }

  private assertOffered(live: EbayCancellationRow): void {
    if (!isCancellationAnswerable(live)) {
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.NOT_OFFERED, 409);
    }
  }

  private async actionsEnabled(): Promise<boolean> {
    return this.platformSettings.getBoolean(PlatformSettingKey.EBAY_CANCELLATIONS_ACTIONS_ENABLED);
  }

  private async readLiveOrThrow(
    row: CancellationRowWithAccount,
    marketplaceId: string
  ): Promise<MappedCancellationDetail> {
    try {
      return await this.readLive(row, marketplaceId, true);
    } catch (error) {
      this.logger.warn(
        `Live read of cancellation ${row.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.UNAVAILABLE, 503);
    }
  }

  /** One live `getCancellation`; `fresh: false` (the drawer) reuses a read younger than `DETAIL_CACHE_MS`. */
  private async readLive(
    row: CancellationRowWithAccount,
    marketplaceId: string,
    fresh: boolean
  ): Promise<MappedCancellationDetail> {
    const cached = this.detailCache.get(row.id);
    if (!fresh && cached && Date.now() - cached.at < DETAIL_CACHE_MS) {
      return cached.value;
    }
    const accessToken = await this.ebay.getAccountAccessToken(row.ebay_account_id);
    const mapped = mapCancellationDetail(await this.postOrder.getCancellation(accessToken, marketplaceId, row.cancel_id));
    if (!mapped) {
      throw new Error('eBay cancellation detail carried no cancelId');
    }
    this.detailCache.set(row.id, { at: Date.now(), value: mapped });
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

/** A buyer's request, still open, that eBay says needs the seller's response. */
export function isCancellationAnswerable(live: EbayCancellationRow): boolean {
  return live.requestorType === EBAY_CANCEL_REQUESTOR_BUYER && live.closedAt === null && live.sellerRespondBy !== null;
}

/**
 * The stored row overlaid with what the live read just said (the returns'
 * `toDetailDto`); no live read → the stored row, `live: false`, no answer.
 * The buyer's login name stays the stored one: an erased buyer stays erased.
 */
export function toCancellationDetailDto(
  stored: EbayCancellationDto,
  live: MappedCancellationDetail | null,
  actionsEnabled: boolean,
  freshnessHours: number,
  ebayUrl: string | null
): EbayCancellationDetailDto {
  if (!live) {
    return {
      ...stored,
      availableActions: [],
      live: false,
      history: [],
      actualRefundAmount: null,
      amountToRecoup: null,
      paymentStatus: null,
      ebayUrl,
    };
  }
  const now = new Date();
  const { row } = live;
  return {
    ...stored,
    state: row.state,
    status: row.status,
    reason: row.reason,
    closeReason: row.closeReason,
    requestorType: row.requestorType,
    requestedAt: row.requestedAt,
    sellerRespondBy: row.sellerRespondBy,
    closedAt: row.closedAt,
    requestedRefundAmount: row.requestedRefundAmount,
    currency: row.currency ?? stored.currency,
    bucket: deriveCancellationBucket(
      {
        state: row.state,
        requestorType: row.requestorType,
        sellerRespondBy: row.sellerRespondBy,
        closedAt: row.closedAt,
        lastSyncedAt: now,
      },
      now,
      freshnessHours
    ),
    lastSyncedAt: now.toISOString(),
    availableActions:
      actionsEnabled && isCancellationAnswerable(row) ? [EbayCancellationAction.APPROVE, EbayCancellationAction.REJECT] : [],
    live: true,
    history: live.history,
    actualRefundAmount: live.actualRefundAmount,
    amountToRecoup: live.amountToRecoup,
    paymentStatus: live.paymentStatus,
    ebayUrl,
  };
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
