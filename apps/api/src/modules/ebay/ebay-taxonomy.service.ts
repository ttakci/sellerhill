import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { DatabaseService } from '../../common/database/database.service';

import type { CategoryAspect } from './aspect-builder';
import {
  buildCategoryQuery,
  categoryQueryHash,
  isUsableLeafCategoryId,
  normalizeAmazonCategory,
  pickCategoryFromRows,
  CategoryMapScope,
  CategoryMapSource,
  type CategoryMapRow,
} from './category-resolution';
import { withEbayRateLimitRetry } from './ebay-http-retry';
import { CategoryAspectsUnavailableError, CategoryResolutionError } from './ebay.errors';

/**
 * eBay category + aspect metadata, with the persistence the create path needs.
 *
 * Both caches used to live in a per-process `Map` inside EbayService, so a cold
 * worker or a taxonomy blip meant: no category (→ the invalid `'1'` fallback)
 * or no aspects (→ a Brand-only listing that failed on every required item
 * specific). Here the answers survive restarts, are shared across workers, and
 * are served stale rather than empty when eBay is unreachable.
 */

/** In-process TTL in front of the DB (a bulk add hits the same category constantly). */
const MEMORY_TTL_MS = 15 * 60 * 1000;
/** How long a stored aspect snapshot is considered fresh. */
const DEFAULT_ASPECT_TTL_HOURS = 168;

export interface ResolveCategoryInput {
  accessToken: string;
  marketplaceId: string;
  categoryTreeId: string;
  asin?: string;
  brand?: string | null;
  title: string;
  amazonCategory?: string | null;
}

export interface ResolvedCategory {
  categoryId: string;
  categoryName: string;
}

interface CategoryMapEntity {
  scope: CategoryMapScope;
  scope_key: string;
  category_id: string;
  category_name: string;
  source: CategoryMapSource;
  is_locked: boolean;
}

interface AspectSnapshotEntity {
  aspects: CategoryAspect[] | string;
  expires_at: Date;
}

@Injectable()
export class EbayTaxonomyService {
  private readonly logger = new Logger(EbayTaxonomyService.name);
  private readonly aspectMemo = new Map<string, { aspects: CategoryAspect[]; expiresAt: number }>();
  private readonly categoryMemo = new Map<string, { resolved: ResolvedCategory; expiresAt: number }>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Resolve the leaf category to list into.
   *
   * Order: operator pin / learned ASIN mapping / Amazon-category mapping /
   * cached query answer → eBay taxonomy → throw. There is deliberately no
   * "default category" fallback: publishing into the wrong category produces a
   * live but unfindable listing, which is worse than a named failure.
   */
  async resolveCategory(input: ResolveCategoryInput): Promise<ResolvedCategory> {
    const query = buildCategoryQuery(input);
    const queryKey = categoryQueryHash(query);
    const amazonCategory = normalizeAmazonCategory(input.amazonCategory);
    const memoKey = `${input.marketplaceId}:${input.categoryTreeId}:${queryKey}`;

    const memo = this.categoryMemo.get(memoKey);
    if (memo && memo.expiresAt > Date.now()) {
      return memo.resolved;
    }

    const stored = await this.loadCategoryMappings(input, { queryKey, amazonCategory });
    const picked = pickCategoryFromRows(stored);
    if (picked) {
      const resolved = { categoryId: picked.categoryId, categoryName: picked.categoryName };
      this.rememberCategory(memoKey, resolved);
      await this.touchCategoryMapping(input, picked);
      return resolved;
    }

    const suggested = await this.fetchCategorySuggestion(input, query);
    this.rememberCategory(memoKey, suggested);
    await this.persistCategoryMappings(input, { queryKey, amazonCategory, resolved: suggested });
    return suggested;
  }

  /**
   * Full aspect metadata for a category: memory → fresh DB snapshot → eBay →
   * stale DB snapshot → throw. Stale metadata beats no metadata; an empty list
   * is never a valid answer.
   */
  async getCategoryAspects(input: {
    accessToken: string;
    marketplaceId: string;
    categoryTreeId: string;
    categoryId: string;
  }): Promise<CategoryAspect[]> {
    const key = `${input.marketplaceId}:${input.categoryTreeId}:${input.categoryId}`;

    const memo = this.aspectMemo.get(key);
    if (memo && memo.expiresAt > Date.now()) {
      return memo.aspects;
    }

    const snapshot = await this.loadAspectSnapshot(input);
    if (snapshot && snapshot.expiresAt.getTime() > Date.now()) {
      this.aspectMemo.set(key, { aspects: snapshot.aspects, expiresAt: Date.now() + MEMORY_TTL_MS });
      return snapshot.aspects;
    }

    try {
      const aspects = await this.fetchCategoryAspects(input);
      this.aspectMemo.set(key, { aspects, expiresAt: Date.now() + MEMORY_TTL_MS });
      await this.persistAspectSnapshot(input, aspects);
      return aspects;
    } catch (error: unknown) {
      if (snapshot) {
        this.logger.warn(
          `Taxonomy unavailable for category ${input.categoryId}; serving aspect snapshot from ` +
            `${snapshot.expiresAt.toISOString()} instead of publishing without item specifics`
        );
        return snapshot.aspects;
      }
      this.logger.error(
        `Failed to fetch aspects for category ${input.categoryId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new CategoryAspectsUnavailableError(input.categoryId);
    }
  }

  // --------------------------------------------------------------- internals

  private rememberCategory(key: string, resolved: ResolvedCategory): void {
    this.categoryMemo.set(key, { resolved, expiresAt: Date.now() + MEMORY_TTL_MS });
  }

  private async loadCategoryMappings(
    input: ResolveCategoryInput,
    keys: { queryKey: string; amazonCategory: string | null }
  ): Promise<CategoryMapRow[]> {
    const scopeKeys = [keys.queryKey];
    if (input.asin) {
      scopeKeys.push(input.asin);
    }
    if (keys.amazonCategory) {
      scopeKeys.push(keys.amazonCategory);
    }

    const placeholders = scopeKeys.map((_, i) => `$${i + 3}`).join(',');
    const rows = await this.databaseService.query<CategoryMapEntity>(
      `SELECT scope, scope_key, category_id, category_name, source, is_locked
       FROM ebay_category_map
       WHERE marketplace_id = $1 AND category_tree_id = $2 AND scope_key IN (${placeholders})`,
      [input.marketplaceId, input.categoryTreeId, ...scopeKeys]
    );

    return rows.map((row) => ({
      scope: row.scope,
      scopeKey: row.scope_key,
      categoryId: row.category_id,
      categoryName: row.category_name,
      source: row.source,
      isLocked: row.is_locked,
    }));
  }

  private async touchCategoryMapping(input: ResolveCategoryInput, row: CategoryMapRow): Promise<void> {
    await this.databaseService.query(
      `UPDATE ebay_category_map
       SET hit_count = hit_count + 1, last_used_at = CURRENT_TIMESTAMP
       WHERE marketplace_id = $1 AND category_tree_id = $2 AND scope = $3 AND scope_key = $4`,
      [input.marketplaceId, input.categoryTreeId, row.scope, row.scopeKey]
    );
  }

  private async persistCategoryMappings(
    input: ResolveCategoryInput,
    args: { queryKey: string; amazonCategory: string | null; resolved: ResolvedCategory }
  ): Promise<void> {
    const entries: Array<{ scope: CategoryMapScope; scopeKey: string }> = [
      { scope: CategoryMapScope.QUERY, scopeKey: args.queryKey },
    ];
    if (input.asin) {
      entries.push({ scope: CategoryMapScope.ASIN, scopeKey: input.asin });
    }

    for (const entry of entries) {
      // `is_locked` guards operator pins: a cached taxonomy answer must never
      // overwrite a mapping someone deliberately set.
      await this.databaseService.query(
        `INSERT INTO ebay_category_map
           (marketplace_id, category_tree_id, scope, scope_key, category_id, category_name, source, hit_count, last_used_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (marketplace_id, category_tree_id, scope, scope_key)
         DO UPDATE SET
           category_id = CASE WHEN ebay_category_map.is_locked THEN ebay_category_map.category_id ELSE EXCLUDED.category_id END,
           category_name = CASE WHEN ebay_category_map.is_locked THEN ebay_category_map.category_name ELSE EXCLUDED.category_name END,
           hit_count = ebay_category_map.hit_count + 1,
           last_used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [
          input.marketplaceId,
          input.categoryTreeId,
          entry.scope,
          entry.scopeKey,
          args.resolved.categoryId,
          args.resolved.categoryName,
          CategoryMapSource.TAXONOMY,
        ]
      );
    }
  }

  private async fetchCategorySuggestion(input: ResolveCategoryInput, query: string): Promise<ResolvedCategory> {
    const url =
      `${this.configService.get('EBAY_REST_API_URL')}/commerce/taxonomy/v1/category_tree/` +
      `${input.categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(query)}`;

    interface SuggestionResponse {
      categorySuggestions?: Array<{ category: { categoryId: string; categoryName?: string } }>;
    }

    let data: SuggestionResponse | undefined;
    try {
      const response = await withEbayRateLimitRetry(
        () =>
          axios.get<SuggestionResponse>(url, {
            headers: { Authorization: `Bearer ${input.accessToken}`, 'Accept-Language': 'en-US' },
          }),
        { logger: this.logger }
      );
      data = response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Category suggestion failed for "${query}": ${error instanceof Error ? error.message : String(error)}`
      );
      throw new CategoryResolutionError(query);
    }

    const leaf = data?.categorySuggestions?.[0]?.category;
    if (!leaf || !isUsableLeafCategoryId(leaf.categoryId)) {
      // Includes eBay answering with its root category, which is not listable.
      throw new CategoryResolutionError(query);
    }

    return { categoryId: leaf.categoryId, categoryName: leaf.categoryName || 'Unknown Category' };
  }

  private async loadAspectSnapshot(input: {
    marketplaceId: string;
    categoryTreeId: string;
    categoryId: string;
  }): Promise<{ aspects: CategoryAspect[]; expiresAt: Date } | null> {
    const rows = await this.databaseService.query<AspectSnapshotEntity>(
      `SELECT aspects, expires_at FROM ebay_category_aspects
       WHERE marketplace_id = $1 AND category_tree_id = $2 AND category_id = $3`,
      [input.marketplaceId, input.categoryTreeId, input.categoryId]
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    const aspects = typeof row.aspects === 'string' ? (JSON.parse(row.aspects) as CategoryAspect[]) : row.aspects;
    if (!Array.isArray(aspects) || aspects.length === 0) {
      return null;
    }
    return { aspects, expiresAt: new Date(row.expires_at) };
  }

  private async persistAspectSnapshot(
    input: { marketplaceId: string; categoryTreeId: string; categoryId: string },
    aspects: CategoryAspect[]
  ): Promise<void> {
    const ttlHours = Number(this.configService.get('EBAY_CATEGORY_ASPECT_TTL_HOURS')) || DEFAULT_ASPECT_TTL_HOURS;

    await this.databaseService.query(
      `INSERT INTO ebay_category_aspects
         (marketplace_id, category_tree_id, category_id, aspects, aspect_count, required_count, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW() + make_interval(hours => $7::int))
       ON CONFLICT (marketplace_id, category_tree_id, category_id)
       DO UPDATE SET
         aspects = EXCLUDED.aspects,
         aspect_count = EXCLUDED.aspect_count,
         required_count = EXCLUDED.required_count,
         fetched_at = CURRENT_TIMESTAMP,
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        input.marketplaceId,
        input.categoryTreeId,
        input.categoryId,
        JSON.stringify(aspects),
        aspects.length,
        aspects.filter((aspect) => aspect.required).length,
        ttlHours,
      ]
    );
  }

  private async fetchCategoryAspects(input: {
    accessToken: string;
    categoryTreeId: string;
    categoryId: string;
  }): Promise<CategoryAspect[]> {
    const url =
      `${this.configService.get('EBAY_REST_API_URL')}/commerce/taxonomy/v1/category_tree/` +
      `${input.categoryTreeId}/get_item_aspects_for_category?category_id=${input.categoryId}`;

    interface AspectsResponse {
      aspects?: Array<{
        localizedAspectName: string;
        aspectConstraint?: {
          aspectRequired?: boolean;
          aspectUsage?: string;
          aspectMode?: string;
          itemToAspectCardinality?: string;
          aspectMaxLength?: number;
        };
        aspectValues?: Array<{ localizedValue?: string }>;
      }>;
    }

    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<AspectsResponse>(url, {
          headers: { Authorization: `Bearer ${input.accessToken}`, 'Accept-Language': 'en-US' },
        }),
      { logger: this.logger }
    );

    const aspects: CategoryAspect[] = (response.data?.aspects ?? []).map((aspect) => ({
      name: aspect.localizedAspectName,
      required:
        aspect.aspectConstraint?.aspectRequired === true ||
        aspect.aspectConstraint?.aspectUsage === 'REQUIRED' ||
        aspect.aspectConstraint?.aspectMode === 'REQUIRED',
      selectionOnly: aspect.aspectConstraint?.aspectMode === 'SELECTION_ONLY',
      multiValue: aspect.aspectConstraint?.itemToAspectCardinality === 'MULTI',
      maxLength: aspect.aspectConstraint?.aspectMaxLength,
      values: (aspect.aspectValues ?? [])
        .map((value) => value.localizedValue)
        .filter((value): value is string => Boolean(value)),
    }));

    if (aspects.length === 0) {
      // A leaf category with zero aspects is an eBay-side anomaly; treat it as
      // unavailable so a stale snapshot or a loud failure wins over silence.
      throw new CategoryAspectsUnavailableError(input.categoryId);
    }

    return aspects;
  }
}
