// apps/api/src/modules/admin/admin-users.service.ts
//
// Read-only per-user monitoring for the admin Users tab: one row per user
// joining operational footprint (active listings, connected accounts, recent
// orders) with period usage/cost attribution from the usage_events projection
// (Keepa fair-split + LLM tokens). Costs stay micro-USD and nullable — no cost
// rows means null, never a fabricated 0.

import { Injectable } from '@nestjs/common';
import type { AdminUserDto, AdminUsersListDto, UserRole, UserStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

interface AdminUserRowDb {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  active_listings: string;
  amazon_accounts: string;
  active_ebay_stores: string;
  orders_30d: string;
  keepa_tokens: string | null;
  llm_tokens: string | null;
  cost_micros: string | null;
  currency: string | null;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUsers(fromIso: string | null, toIso: string | null): Promise<AdminUsersListDto> {
    const period = this.resolvePeriod(fromIso, toIso);
    const rows = await this.databaseService.query<AdminUserRowDb>(
      `SELECT u.id, u.email, u.role, u.status, u.created_at,
              COALESCE(l.cnt, 0)::TEXT AS active_listings,
              COALESCE(a.cnt, 0)::TEXT AS amazon_accounts,
              COALESCE(e.cnt, 0)::TEXT AS active_ebay_stores,
              COALESCE(o.cnt, 0)::TEXT AS orders_30d,
              ue.keepa_tokens::TEXT AS keepa_tokens,
              ue.llm_tokens::TEXT AS llm_tokens,
              ue.cost_micros::TEXT AS cost_micros,
              ue.currency
         FROM users u
         LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM listings WHERE status = 'active' GROUP BY user_id) l
                ON l.user_id = u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM amazon_accounts GROUP BY user_id) a
                ON a.user_id = u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM ebay_accounts WHERE status = 'active' GROUP BY user_id) e
                ON e.user_id = u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM orders
                     WHERE order_date >= NOW() - INTERVAL '30 days' GROUP BY user_id) o
                ON o.user_id = u.id
         LEFT JOIN (
           SELECT user_id,
                  COALESCE(SUM(quantity) FILTER (WHERE source = 'keepa'), 0) AS keepa_tokens,
                  COALESCE(SUM(quantity) FILTER (WHERE source = 'llm'), 0) AS llm_tokens,
                  SUM(estimated_cost_micros) AS cost_micros,
                  MAX(currency) AS currency
             FROM usage_events
            WHERE recorded_at >= $1 AND recorded_at < $2 AND user_id IS NOT NULL
            GROUP BY user_id
         ) ue ON ue.user_id = u.id
        ORDER BY ue.cost_micros DESC NULLS LAST, u.created_at ASC`,
      [period.from, period.to],
    );
    return {
      generatedAt: new Date().toISOString(),
      from: period.from,
      to: period.to,
      users: rows.map((row) => this.mapRow(row)),
    };
  }

  private mapRow(row: AdminUserRowDb): AdminUserDto {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      activeListings: this.parseIntSafe(row.active_listings),
      amazonAccounts: this.parseIntSafe(row.amazon_accounts),
      activeEbayStores: this.parseIntSafe(row.active_ebay_stores),
      ordersLast30Days: this.parseIntSafe(row.orders_30d),
      keepaTokens: row.keepa_tokens === null ? 0 : Number.parseFloat(row.keepa_tokens) || 0,
      llmTokens: row.llm_tokens === null ? 0 : Number.parseFloat(row.llm_tokens) || 0,
      estimatedCostMicros: row.cost_micros === null ? null : Number.parseInt(row.cost_micros, 10),
      currency: row.currency,
    };
  }

  private resolvePeriod(fromIso: string | null, toIso: string | null): { from: string; to: string } {
    const now = new Date();
    const to = toIso && !Number.isNaN(Date.parse(toIso)) ? toIso : now.toISOString();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const from = fromIso && !Number.isNaN(Date.parse(fromIso)) ? fromIso : defaultFrom;
    return { from, to };
  }

  private parseIntSafe(s: string | undefined | null): number {
    if (!s) {return 0;}
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }
}
