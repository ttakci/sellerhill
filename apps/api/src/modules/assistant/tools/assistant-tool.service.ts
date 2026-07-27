import { Injectable } from '@nestjs/common';
import { AssistantToolName, AutoFulfillStatus, ListingStatus, OrderCostCaptureStatus, type AssistantToolRequest } from '@repo/shared';

import { DatabaseService } from '../../../common/database/database.service';

export interface AssistantToolResult { name: AssistantToolName; resourceId: string | null; data: Record<string, unknown>; resultCount: number }

type Row = Record<string, string | number | boolean | Date | null>;
const MAX_LIMIT = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AssistantToolService {
  constructor(private readonly db: DatabaseService) {}

  async execute(userId: string, request: AssistantToolRequest): Promise<AssistantToolResult> {
    if (!UUID.test(userId)) {return this.empty(request.name);}
    switch (request.name) {
      case AssistantToolName.ACCOUNT_OVERVIEW: return this.accountOverview(userId);
      case AssistantToolName.DASHBOARD_SUMMARY: return this.dashboard(userId, request);
      case AssistantToolName.LISTINGS_SUMMARY: return this.listings(userId, request);
      case AssistantToolName.LISTING_DETAIL: return this.listing(userId, request.resourceId);
      case AssistantToolName.ORDERS_SUMMARY: return this.orders(userId, request);
      case AssistantToolName.ORDER_DETAIL: return this.order(userId, request.resourceId);
      case AssistantToolName.STORE_SETTINGS_SUMMARY: return this.settings(userId);
    }
  }

  private empty(name: AssistantToolName, resourceId: string | null = null): AssistantToolResult { return { name, resourceId, data: {}, resultCount: 0 }; }
  private limit(value?: number): number { return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value ?? 5))); }
  private days(period?: string): number { return period === 'today' ? 1 : period === 'week' ? 7 : period === 'year' ? 365 : 30; }
  private async one(name: AssistantToolName, resourceId: string | null, sql: string, params: (string | number)[]): Promise<AssistantToolResult> {
    const rows = await this.db.query<Row>(sql, params); return rows[0] ? { name, resourceId, data: rows[0], resultCount: 1 } : this.empty(name, resourceId);
  }

  private accountOverview(userId: string): Promise<AssistantToolResult> { return this.one(AssistantToolName.ACCOUNT_OVERVIEW, null, `SELECT (SELECT COUNT(*)::int FROM ebay_accounts WHERE user_id=$1) AS "ebayStoreCount", (SELECT COUNT(*)::int FROM amazon_accounts WHERE user_id=$1) AS "amazonAccountCount", EXISTS(SELECT 1 FROM ebay_accounts WHERE user_id=$1) AS "setupComplete", COALESCE((SELECT auto_fulfill_enabled FROM store_settings WHERE user_id=$1 AND is_global=TRUE LIMIT 1),FALSE) AS "autoFulfillEnabled"`, [userId]); }
  private dashboard(userId: string, request: AssistantToolRequest): Promise<AssistantToolResult> { const days = this.days(request.period); return this.one(AssistantToolName.DASHBOARD_SUMMARY, null, `SELECT COALESCE(SUM(sale_total),0)::float AS sales, COUNT(*)::int AS orders, COALESCE(SUM(quantity),0)::int AS units, COALESCE(SUM(net_profit) FILTER (WHERE cost_capture_status=$3),0)::float AS "confirmedProfit", COALESCE(SUM(net_profit) FILTER (WHERE cost_capture_status=$4),0)::float AS "provisionalProfit", COALESCE(SUM(sale_total) FILTER (WHERE cost_capture_status NOT IN ($3,$4)),0)::float AS "uncostedRevenue" FROM orders WHERE user_id=$1 AND order_date >= NOW()-($2::int*INTERVAL '1 day')`, [userId, days, OrderCostCaptureStatus.LINKED, OrderCostCaptureStatus.PROVISIONAL]); }
  private async listings(userId: string, request: AssistantToolRequest): Promise<AssistantToolResult> { const rows = await this.db.query<Row>(`SELECT id,title,status,price::float,quantity,asin FROM listings WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2`, [userId, this.limit(request.limit)]); const counts = await this.db.query<Row>(`SELECT COUNT(*)::int AS count, COUNT(*) FILTER(WHERE status=$2)::int AS active, COUNT(*) FILTER(WHERE status=$3)::int AS draft, COUNT(*) FILTER(WHERE status=$4)::int AS inactive, COUNT(*) FILTER(WHERE quantity<=0)::int AS "outOfStock" FROM listings WHERE user_id=$1`, [userId, ListingStatus.ACTIVE, ListingStatus.DRAFT, ListingStatus.INACTIVE]); return { name: AssistantToolName.LISTINGS_SUMMARY, resourceId: null, data: { ...(counts[0] ?? {}), items: rows }, resultCount: rows.length }; }
  private listing(userId: string, id?: string): Promise<AssistantToolResult> { if (!id || !UUID.test(id)) {return Promise.resolve(this.empty(AssistantToolName.LISTING_DETAIL));} return this.one(AssistantToolName.LISTING_DETAIL, id, `SELECT l.id,l.title,l.asin,l.status,l.price::float,l.quantity,l.disable_ordering AS "pauseSales",l.lock_price AS "fixedPrice",l.lock_quantity AS "fixedQuantity",e.seller_id AS "storeLabel",l.updated_at AS "lastRefreshAt",(SELECT MAX(o.order_date) FROM orders o WHERE o.listing_id=l.id AND o.user_id=$1) AS "lastSaleAt" FROM listings l LEFT JOIN ebay_accounts e ON e.id=l.ebay_account_id AND e.user_id=$1 WHERE l.id=$2 AND l.user_id=$1`, [userId, id]); }
  private orders(userId: string, request: AssistantToolRequest): Promise<AssistantToolResult> { const days = this.days(request.period); return this.one(AssistantToolName.ORDERS_SUMMARY, null, `SELECT COUNT(*)::int AS count,COALESCE(SUM(sale_total),0)::float AS "saleTotal",COALESCE(SUM(net_profit) FILTER(WHERE cost_capture_status=$3),0)::float AS "confirmedProfit",COALESCE(SUM(net_profit) FILTER(WHERE cost_capture_status=$4),0)::float AS "provisionalProfit",COALESCE(SUM(sale_total) FILTER(WHERE cost_capture_status NOT IN($3,$4)),0)::float AS "uncostedRevenue",COUNT(*) FILTER(WHERE auto_fulfill_status IN($5,$6))::int AS "autoFulfillAttentionCount" FROM orders WHERE user_id=$1 AND order_date>=NOW()-($2::int*INTERVAL '1 day')`, [userId, days, OrderCostCaptureStatus.LINKED, OrderCostCaptureStatus.PROVISIONAL, AutoFulfillStatus.BLOCKED, AutoFulfillStatus.FAILED]); }
  private order(userId: string, id?: string): Promise<AssistantToolResult> { if (!id || !UUID.test(id)) {return Promise.resolve(this.empty(AssistantToolName.ORDER_DETAIL));} return this.one(AssistantToolName.ORDER_DETAIL, id, `SELECT id,ebay_order_id AS "orderId",status,order_fulfillment_status AS "fulfillmentStatus",payment_status AS "paymentStatus",cost_capture_status AS "costCaptureStatus",CASE WHEN cost_capture_status=$3 THEN 'confirmed' WHEN cost_capture_status=$4 THEN 'estimated' ELSE NULL END AS "profitBasis",net_profit::float AS "netProfit",auto_fulfill_status AS "autoFulfillStatus",auto_fulfill_blocked_reason AS "autoFulfillReason",amazon_tracking_carrier AS "trackingCarrier",order_date AS "orderDate" FROM orders WHERE id=$2 AND user_id=$1`, [userId, id, OrderCostCaptureStatus.LINKED, OrderCostCaptureStatus.PROVISIONAL]); }
  private settings(userId: string): Promise<AssistantToolResult> { return this.one(AssistantToolName.STORE_SETTINGS_SUMMARY, null, `SELECT amazon_tax_rate::float AS "amazonTaxRate",auto_fulfill_enabled AS "autoFulfillEnabled",tracking_conversion_provider AS "trackingConversionProvider",EXISTS(SELECT 1 FROM ebay_accounts e WHERE e.user_id=$1) AS "storeSetupComplete" FROM store_settings WHERE user_id=$1 AND is_global=TRUE LIMIT 1`, [userId]); }
}
