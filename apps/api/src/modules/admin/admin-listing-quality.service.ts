import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AspectDefaultSourceDto,
  type AdminAspectDefaultDto,
  type AdminAspectDefaultsListDto,
  type AdminCategoryMappingDto,
  type AdminListingQualitySummaryDto,
  type UpsertAspectDefaultRequest,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import { normalizeAspectKey, validateCuratedAspectValue } from './listing-quality.helpers';

/**
 * Operator view + curation of the item-specifics intelligence.
 *
 * Read surfaces answer "how are listings actually being filled"; the single
 * write surface is the curated default, which is the intended way to correct a
 * category once for every customer instead of chasing individual listings.
 */

interface AspectDefaultRow {
  id: string;
  marketplace_id: string;
  category_id: string;
  aspect_name: string;
  value: string;
  source: AspectDefaultSourceDto;
  origin_layer: string;
  is_override: boolean;
  confidence: number;
  use_count: string | number;
  success_count: string | number;
  failure_count: string | number;
  stale_at: Date | null;
  last_used_at: Date | null;
  updated_at: Date;
}

@Injectable()
export class AdminListingQualityService {
  private readonly logger = new Logger(AdminListingQualityService.name);

  // NOTE: deliberately NO EbayTaxonomyService here. LlmModule imports
  // AdminModule, so importing EbayModule into AdminModule closes the cycle
  // EbayModule -> LlmModule -> AdminModule -> EbayModule and Nest fails to
  // boot. Allowed values are read from the `ebay_category_aspects` snapshot
  // table instead, which is what the create path populates anyway.
  constructor(private readonly databaseService: DatabaseService) {}

  async listAspectDefaults(filters: {
    marketplaceId?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminAspectDefaultsListDto> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filters.marketplaceId) {
      params.push(filters.marketplaceId);
      conditions.push(`marketplace_id = $${params.length}`);
    }
    if (filters.categoryId) {
      params.push(filters.categoryId);
      conditions.push(`category_id = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      conditions.push(`(LOWER(aspect_name) LIKE $${params.length} OR LOWER(value) LIKE $${params.length})`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, counts] = await Promise.all([
      this.databaseService.query<AspectDefaultRow>(
        `SELECT id, marketplace_id, category_id, aspect_name, value, source, origin_layer,
                is_override, confidence, use_count, success_count, failure_count,
                stale_at, last_used_at, updated_at
         FROM ebay_aspect_defaults
         ${where}
         ORDER BY (source = 'curated') DESC, success_count DESC, updated_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ebay_aspect_defaults ${where}`,
        params
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      items: rows.map((row) => this.mapDefault(row)),
      total: Number(counts[0]?.count ?? 0),
      page,
      limit,
    };
  }

  /**
   * Create or replace the curated value for one aspect.
   *
   * A SELECTION_ONLY aspect is validated against eBay's current allowed values
   * BEFORE it is stored: an unaccepted curated value would otherwise turn the
   * admin panel into a new source of publish failures, which is exactly the
   * class of bug this whole feature exists to remove.
   */
  async upsertAspectDefault(request: UpsertAspectDefaultRequest, actorUserId: string): Promise<AdminAspectDefaultDto> {
    const aspectKey = normalizeAspectKey(request.aspectName);
    if (!aspectKey) {
      throw new BadRequestException('aspectName is required');
    }

    await this.assertValueAllowed(request);

    const rows = await this.databaseService.query<AspectDefaultRow>(
      `INSERT INTO ebay_aspect_defaults
         (marketplace_id, category_id, aspect_key, aspect_name, value,
          source, origin_layer, is_override, confidence, created_by)
       VALUES ($1, $2, $3, $4, $5, 'curated', 'admin', $6, 100, $7)
       ON CONFLICT (marketplace_id, category_id, aspect_key) WHERE source = 'curated'
       DO UPDATE SET
         aspect_name = EXCLUDED.aspect_name,
         value = EXCLUDED.value,
         is_override = EXCLUDED.is_override,
         confidence = 100,
         stale_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, marketplace_id, category_id, aspect_name, value, source, origin_layer,
                 is_override, confidence, use_count, success_count, failure_count,
                 stale_at, last_used_at, updated_at`,
      [
        request.marketplaceId,
        request.categoryId,
        aspectKey,
        request.aspectName.trim(),
        request.value.trim(),
        request.isOverride ?? false,
        actorUserId,
      ]
    );

    this.logger.log(
      `Curated aspect default ${request.aspectName}="${request.value}" for category ${request.categoryId}`
    );
    return this.mapDefault(rows[0]);
  }

  /** Delete a curated row; a learned row is marked stale instead (history is evidence). */
  async removeAspectDefault(id: string): Promise<void> {
    await this.databaseService.query(
      `WITH target AS (SELECT id, source FROM ebay_aspect_defaults WHERE id = $1),
            marked AS (
              UPDATE ebay_aspect_defaults SET stale_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
              WHERE id = (SELECT id FROM target WHERE source = 'learned')
            )
       DELETE FROM ebay_aspect_defaults
       WHERE id = (SELECT id FROM target WHERE source = 'curated')`,
      [id]
    );
  }

  /**
   * How item specifics were actually filled recently.
   *
   * Reads the per-listing audit written at create time, so it reflects what
   * buyers see rather than what the code intends.
   */
  async getSummary(periodDays: number): Promise<AdminListingQualitySummaryDto> {
    const days = Math.min(365, Math.max(1, periodDays));

    const [totals, coverage, fallback] = await Promise.all([
      this.databaseService.query<{ listings: string; autofilled: string; avg_specifics: string | null }>(
        `SELECT COUNT(*)::text AS listings,
                COUNT(*) FILTER (WHERE aspect_autofilled_count > 0)::text AS autofilled,
                AVG(jsonb_array_length(aspect_resolution -> 'decisions'))::text AS avg_specifics
         FROM listings
         WHERE aspect_resolution IS NOT NULL
           AND created_at >= NOW() - make_interval(days => $1::int)`,
        [days]
      ),
      this.databaseService.query<{
        category_id: string | null;
        layer: string;
        aspect_count: string;
        listing_count: string;
      }>(
        `SELECT l.ebay_category_id AS category_id,
                d ->> 'l' AS layer,
                COUNT(*)::text AS aspect_count,
                COUNT(DISTINCT l.id)::text AS listing_count
         FROM listings l
         CROSS JOIN LATERAL jsonb_array_elements(l.aspect_resolution -> 'decisions') AS d
         WHERE l.aspect_resolution IS NOT NULL
           AND l.created_at >= NOW() - make_interval(days => $1::int)
         GROUP BY 1, 2
         ORDER BY 3 DESC
         LIMIT 100`,
        [days]
      ),
      this.databaseService.query<{ category_id: string | null; listing_count: string }>(
        `SELECT ebay_category_id AS category_id, COUNT(*)::text AS listing_count
         FROM listings
         WHERE aspect_autofilled_count > 0
           AND created_at >= NOW() - make_interval(days => $1::int)
         GROUP BY 1
         ORDER BY 2 DESC
         LIMIT 10`,
        [days]
      ),
    ]);

    const row = totals[0];
    return {
      generatedAt: new Date().toISOString(),
      periodDays: days,
      listingsAnalyzed: Number(row?.listings ?? 0),
      listingsWithAutofill: Number(row?.autofilled ?? 0),
      averageSpecifics: row?.avg_specifics ? Math.round(Number(row.avg_specifics) * 10) / 10 : 0,
      coverage: coverage.map((entry) => ({
        categoryId: entry.category_id ?? '',
        layer: entry.layer,
        aspectCount: Number(entry.aspect_count),
        listingCount: Number(entry.listing_count),
      })),
      topFallbackCategories: fallback.map((entry) => ({
        categoryId: entry.category_id ?? '',
        listingCount: Number(entry.listing_count),
      })),
    };
  }

  /** Category mappings the resolver learned or an operator pinned. */
  async listCategoryMappings(limit = 50): Promise<AdminCategoryMappingDto[]> {
    const rows = await this.databaseService.query<{
      id: string;
      marketplace_id: string;
      scope: string;
      scope_key: string;
      category_id: string;
      category_name: string;
      source: string;
      is_locked: boolean;
      hit_count: string;
      last_used_at: Date | null;
    }>(
      `SELECT id, marketplace_id, scope, scope_key, category_id, category_name,
              source, is_locked, hit_count, last_used_at
       FROM ebay_category_map
       ORDER BY hit_count DESC, updated_at DESC
       LIMIT ${Math.min(200, Math.max(1, limit))}`
    );

    return rows.map((row) => ({
      id: row.id,
      marketplaceId: row.marketplace_id,
      scope: row.scope,
      scopeKey: row.scope_key,
      categoryId: row.category_id,
      categoryName: row.category_name,
      source: row.source,
      isLocked: row.is_locked,
      hitCount: Number(row.hit_count),
      lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
    }));
  }

  // --------------------------------------------------------------- internals

  /**
   * Reject a curated value the category cannot accept.
   *
   * Best-effort: when the cached metadata is unavailable the value is allowed
   * through rather than blocking curation on a taxonomy outage — the resolver
   * revalidates it on read anyway.
   */
  private async assertValueAllowed(request: UpsertAspectDefaultRequest): Promise<void> {
    const rows = await this.databaseService.query<{ aspects: unknown }>(
      `SELECT aspects FROM ebay_category_aspects
       WHERE marketplace_id = $1 AND category_id = $2
       LIMIT 1`,
      [request.marketplaceId, request.categoryId]
    );

    const raw = rows[0]?.aspects;
    if (!raw) {
      return;
    }

    const aspects = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Array<{
      name: string;
      selectionOnly: boolean;
      values: string[];
    }>;

    const problem = validateCuratedAspectValue(aspects, request.aspectName, request.value);
    if (problem) {
      throw new BadRequestException(problem);
    }
  }

  private mapDefault(row: AspectDefaultRow): AdminAspectDefaultDto {
    return {
      id: row.id,
      marketplaceId: row.marketplace_id,
      categoryId: row.category_id,
      aspectName: row.aspect_name,
      value: row.value,
      source: row.source,
      originLayer: row.origin_layer,
      isOverride: row.is_override,
      confidence: row.confidence,
      useCount: Number(row.use_count),
      successCount: Number(row.success_count),
      failureCount: Number(row.failure_count),
      staleAt: row.stale_at ? row.stale_at.toISOString() : null,
      lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
