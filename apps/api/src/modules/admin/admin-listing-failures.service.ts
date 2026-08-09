import { Injectable } from '@nestjs/common';
import {
  ListingStatus,
  type AdminListingFailureBreakdownDto,
  type AdminListingFailureDto,
  type AdminListingFailuresDto,
  type AdminListingFailuresQuery,
  type ListingFailureCode,
  type ListingFailureDetails,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface FailureRow {
  item_id: string;
  job_id: string;
  asin: string;
  user_id: string;
  user_email: string;
  failure_code: string | null;
  failure_details: ListingFailureDetails | string | null;
  error_message: string | null;
  attempted_at: Date;
  total: string;
}

/**
 * Operator read model over failed listing attempts.
 *
 * The seller-facing job view deliberately shows only the localized reason for a
 * `failureCode`; the provider's raw text is stripped there because it names
 * eBay error ids and internal fields that a seller cannot act on. That text is
 * still the fastest route to a diagnosis, so it surfaces here instead — one
 * place, role-gated, with the account context support needs.
 *
 * Read-only. Nothing in the admin panel mutates listing state; a retry still
 * goes through the owning module's own endpoint with its own guard chain.
 */
@Injectable()
export class AdminListingFailuresService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(query: AdminListingFailuresQuery): Promise<AdminListingFailuresDto> {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(query.limit) || DEFAULT_LIMIT)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [`i.status = $1`];
    const params: Array<string | number> = [ListingStatus.ERROR];

    if (query.failureCode) {
      params.push(query.failureCode);
      conditions.push(`i.failure_code = $${params.length}`);
    }
    if (query.search?.trim()) {
      params.push(`${query.search.trim()}%`);
      conditions.push(`(i.asin ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const rows = await this.databaseService.query<FailureRow>(
      `SELECT i.id            AS item_id,
              i.job_id        AS job_id,
              i.asin          AS asin,
              j.user_id       AS user_id,
              u.email         AS user_email,
              i.failure_code  AS failure_code,
              i.failure_details AS failure_details,
              i.error_message AS error_message,
              i.updated_at    AS attempted_at,
              COUNT(*) OVER () AS total
       FROM listing_job_items i
       JOIN listing_jobs j ON j.id = i.job_id
       JOIN users u ON u.id = j.user_id
       WHERE ${where}
       ORDER BY i.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      items: rows.map((row) => this.toDto(row)),
      total: rows[0] ? Number(rows[0].total) : 0,
      page,
      limit,
      breakdown: await this.breakdown(),
    };
  }

  /** Failure counts by code over the last 30 days — which class to fix first. */
  private async breakdown(): Promise<AdminListingFailureBreakdownDto[]> {
    const rows = await this.databaseService.query<{ failure_code: string | null; count: string }>(
      `SELECT i.failure_code, COUNT(*)::text AS count
       FROM listing_job_items i
       WHERE i.status = $1 AND i.updated_at >= NOW() - INTERVAL '30 days'
       GROUP BY i.failure_code
       ORDER BY COUNT(*) DESC`,
      [ListingStatus.ERROR]
    );

    return rows.map((row) => ({
      failureCode: (row.failure_code as ListingFailureCode) ?? null,
      count: Number(row.count),
    }));
  }

  private toDto(row: FailureRow): AdminListingFailureDto {
    const details =
      typeof row.failure_details === 'string'
        ? (JSON.parse(row.failure_details) as ListingFailureDetails)
        : row.failure_details;

    return {
      itemId: row.item_id,
      jobId: row.job_id,
      asin: row.asin,
      userId: row.user_id,
      userEmail: row.user_email,
      failureCode: (row.failure_code as ListingFailureCode) ?? null,
      failureDetails: details ?? null,
      technicalMessage: row.error_message,
      attemptedAt: new Date(row.attempted_at).toISOString(),
    };
  }
}
