// apps/api/src/modules/ebay-returns/ebay-returns.service.ts

import { Injectable } from '@nestjs/common';
import {
  ACTIONABLE_RETURN_BUCKETS,
  buildReturnBucketSql,
  deriveReturnBucket,
  EbayReturnDto,
  PaginatedReturnsDto,
  resolveReturnFreshnessHours,
  RETURN_TABS,
  ReturnBucket,
  ReturnBucketCountsDto,
  ReturnsQueryDto,
  ReturnTab,
} from '@repo/shared';

import { DatabaseService, QueryParam } from '../../common/database/database.service';

import { RETURNS_DEFAULT_PAGE_SIZE, RETURNS_MAX_PAGE_SIZE } from './ebay-returns.constants';
import { ReturnSweepScheduleService } from './return-sweep-schedule.service';

interface ReturnListRow {
  id: string;
  return_id: string;
  ebay_account_id: string;
  ebay_order_id: string | null;
  order_id: string | null;
  ebay_item_id: string | null;
  return_quantity: number | null;
  state: string | null;
  status: string | null;
  reason: string | null;
  reason_type: string | null;
  buyer_comment: string | null;
  buyer_login_name: string | null;
  seller_activity_due: string | null;
  seller_respond_by: Date | string | null;
  estimated_refund_amount: string | number | null;
  actual_refund_amount: string | number | null;
  currency: string | null;
  created_on_ebay_at: Date | string | null;
  last_synced_at: Date | string;
  listing_id: string | null;
  listing_title: string | null;
  listing_asin: string | null;
  product_image_urls: string[] | string | null;
}

interface BucketCountRow {
  bucket: string;
  count: number | string;
}

/** Same joins the orders list uses to reach a row's product (title / ASIN on the listing, image on the product). */
const PRODUCT_JOINS = `LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN listings l ON l.id = o.listing_id
       LEFT JOIN products p ON p.id = l.product_id`;

function clampPage(page: number | undefined): number {
  return typeof page === 'number' && Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1) {
    return RETURNS_DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(limit), RETURNS_MAX_PAGE_SIZE);
}

/** `%`, `_` and the escape character itself are literals in a search term. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** pg hands NUMERIC back as a string. */
function toAmount(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `products.image_urls` is JSONB (already an array); a legacy row may hold a JSON string. */
function firstImageUrl(raw: string[] | string | null): string | null {
  if (!raw) {
    return null;
  }
  let urls: unknown = raw;
  if (typeof raw === 'string') {
    try {
      urls = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(urls)) {
    return null;
  }
  const first: unknown = urls[0];
  return typeof first === 'string' && first !== '' ? first : null;
}

function emptyCounts(): ReturnBucketCountsDto {
  return {
    [ReturnBucket.UNCONFIRMED]: 0,
    [ReturnBucket.ACTION_OVERDUE]: 0,
    [ReturnBucket.ACTION_DUE]: 0,
    [ReturnBucket.ESCALATED]: 0,
    [ReturnBucket.IN_PROGRESS]: 0,
    [ReturnBucket.CLOSED]: 0,
  };
}

const RETURN_BUCKETS = new Set<string>(Object.values(ReturnBucket));

/**
 * The seller-facing read side of eBay returns. Reads `ebay_returns` only —
 * eBay itself is called by the background sweep (`EbayReturnsSyncService`),
 * never from a page load, because the Post-Order quota is shared by every
 * seller.
 *
 * Every statement is scoped `WHERE r.user_id = $1`
 * (`ebay-returns.guard.spec.ts` checks each one).
 */
@Injectable()
export class EbayReturnsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly schedule: ReturnSweepScheduleService
  ) {}

  /**
   * The bucket CASE over the `r` alias — the one expression the list filters,
   * sorts and counts by — with the freshness horizon of the moment. The
   * horizon follows the interval the sweep is ACTUALLY running at
   * (`ReturnSweepScheduleService` — derived from the store count and the
   * quota), so it is resolved per request rather than frozen at module load.
   */
  private async bucketContext(): Promise<{ bucketSql: string; freshnessHours: number }> {
    const freshnessHours = resolveReturnFreshnessHours((await this.schedule.resolve()).intervalHours);
    return { bucketSql: buildReturnBucketSql('r', freshnessHours), freshnessHours };
  }

  async list(userId: string, query: ReturnsQueryDto = {}): Promise<PaginatedReturnsDto> {
    const page = clampPage(query.page);
    const limit = clampLimit(query.limit);
    const { bucketSql, freshnessHours } = await this.bucketContext();

    const params: QueryParam[] = [userId];
    let filters = '';

    const buckets = query.tab ? RETURN_TABS[query.tab] : undefined;
    if (buckets && query.tab !== ReturnTab.ALL) {
      params.push([...buckets]);
      filters += ` AND ${bucketSql} = ANY($${params.length}::text[])`;
    }
    if (query.ebayAccountId) {
      params.push(query.ebayAccountId);
      filters += ` AND r.ebay_account_id = $${params.length}::uuid`;
    }
    const search = query.search?.trim();
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      const term = `$${params.length}`;
      filters += ` AND (r.return_id ILIKE ${term} OR r.ebay_order_id ILIKE ${term} OR l.title ILIKE ${term})`;
    }

    // Same joins as the page query, so a search on the product title counts
    // exactly the rows the page returns. None of the joins can multiply a row.
    const countRows = await this.database.query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count
         FROM ebay_returns r
       ${PRODUCT_JOINS}
        WHERE r.user_id = $1${filters}`,
      params
    );
    const total = Number(countRows[0]?.count ?? 0) || 0;

    // What needs the seller floats to the top, soonest deadline first; the
    // rest follows newest first. `r.id` makes the order total, so a row can
    // never appear on two pages.
    const actionableIndex = params.length + 1;
    const limitIndex = params.length + 2;
    const offsetIndex = params.length + 3;
    const rows = await this.database.query<ReturnListRow>(
      `SELECT r.id, r.return_id, r.ebay_account_id, r.ebay_order_id, r.order_id,
              r.ebay_item_id, r.return_quantity, r.state, r.status, r.reason, r.reason_type,
              r.buyer_comment, r.buyer_login_name, r.seller_activity_due, r.seller_respond_by,
              r.estimated_refund_amount, r.actual_refund_amount, r.currency,
              r.created_on_ebay_at, r.last_synced_at,
              l.id AS listing_id,
              l.title AS listing_title,
              l.asin AS listing_asin,
              p.image_urls AS product_image_urls
         FROM ebay_returns r
       ${PRODUCT_JOINS}
        WHERE r.user_id = $1${filters}
        ORDER BY CASE WHEN ${bucketSql} = ANY($${actionableIndex}::text[]) THEN 0 ELSE 1 END,
                 r.seller_respond_by ASC NULLS LAST,
                 r.created_on_ebay_at DESC NULLS LAST,
                 r.id ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...params, [...ACTIONABLE_RETURN_BUCKETS], limit, (page - 1) * limit]
    );

    const now = new Date();
    return { items: rows.map((row) => this.toDto(row, now, freshnessHours)), total, page, limit };
  }

  /** How many returns sit in each bucket — every bucket present, zero-filled. */
  async counts(userId: string, filter: { ebayAccountId?: string } = {}): Promise<ReturnBucketCountsDto> {
    const params: QueryParam[] = [userId];
    let filters = '';
    if (filter.ebayAccountId) {
      params.push(filter.ebayAccountId);
      filters += ` AND r.ebay_account_id = $${params.length}::uuid`;
    }

    const { bucketSql } = await this.bucketContext();
    const rows = await this.database.query<BucketCountRow>(
      `SELECT ${bucketSql} AS bucket, COUNT(*)::int AS count
         FROM ebay_returns r
        WHERE r.user_id = $1${filters}
        GROUP BY 1`,
      params
    );

    const counts = emptyCounts();
    for (const row of rows) {
      if (RETURN_BUCKETS.has(row.bucket)) {
        counts[row.bucket as ReturnBucket] = Number(row.count) || 0;
      }
    }
    return counts;
  }

  private toDto(row: ReturnListRow, now: Date, freshnessHours: number): EbayReturnDto {
    return {
      id: row.id,
      returnId: row.return_id,
      ebayAccountId: row.ebay_account_id,
      ebayOrderId: row.ebay_order_id,
      orderId: row.order_id,
      ebayItemId: row.ebay_item_id,
      returnQuantity: row.return_quantity,
      bucket: deriveReturnBucket(
        {
          state: row.state,
          status: row.status,
          sellerActivityDue: row.seller_activity_due,
          sellerRespondBy: row.seller_respond_by,
          lastSyncedAt: row.last_synced_at,
        },
        now,
        freshnessHours
      ),
      state: row.state,
      status: row.status,
      reason: row.reason,
      reasonType: row.reason_type,
      buyerComment: row.buyer_comment,
      buyerLoginName: row.buyer_login_name,
      sellerActivityDue: row.seller_activity_due,
      sellerRespondBy: toIso(row.seller_respond_by),
      estimatedRefundAmount: toAmount(row.estimated_refund_amount),
      actualRefundAmount: toAmount(row.actual_refund_amount),
      currency: row.currency,
      createdOnEbayAt: toIso(row.created_on_ebay_at),
      lastSyncedAt: toIso(row.last_synced_at) ?? now.toISOString(),
      product: row.listing_id
        ? {
            title: row.listing_title,
            imageUrl: firstImageUrl(row.product_image_urls),
            asin: row.listing_asin,
          }
        : null,
    };
  }
}
