import { Injectable, Logger } from '@nestjs/common';
import type { ProductIdentifiers } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import {
  buildAspectResolution,
  matchAspectValue,
  AspectResolutionLayer,
  type AspectResolution,
  type CategoryAspect,
  type ResolvedAspectOverride,
} from './aspect-builder';
import { AspectLlmService } from './aspect-llm.service';

/**
 * Async half of the item-specifics ladder: the layers that need the database.
 *
 * The pure builder handles product data, priors and the terminal guarantee.
 * This service supplies what the platform has LEARNED — operator-curated values
 * and values that previously published successfully in the same category — and
 * feeds successes/rejections back so the same question is never asked twice.
 *
 * Steady state for a category we have seen before: one indexed read, no
 * provider calls at all.
 */

export enum AspectDefaultSource {
  CURATED = 'curated',
  LEARNED = 'learned',
}

export interface AspectResolveRequest {
  marketplaceId: string;
  categoryId: string;
  categoryAspects: CategoryAspect[];
  forcedAspectNames?: string[];
  product: {
    title: string;
    brand?: string;
    specs?: Record<string, string>;
    features?: string[];
    identifiers?: ProductIdentifiers;
  };
}

interface AspectDefaultEntity {
  aspect_key: string;
  aspect_name: string;
  value: string;
  source: AspectDefaultSource;
  is_override: boolean;
  confidence: number;
  success_count: string | number;
}

/** Lower-case, strip everything but a–z0–9 — must match aspect-builder. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

@Injectable()
export class AspectResolverService {
  private readonly logger = new Logger(AspectResolverService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly aspectLlm: AspectLlmService
  ) {}

  /**
   * Build the final item-specifics map for a listing.
   *
   * Curated values outrank product data (an operator sets one precisely because
   * the scraped value was wrong); learned values sit below it, as a fallback
   * before the built-in priors.
   */
  async resolve(request: AspectResolveRequest): Promise<AspectResolution> {
    const stored = await this.loadDefaults(request.marketplaceId, request.categoryId);

    const overrides: Record<string, ResolvedAspectOverride> = {};
    const hardOverrides: Record<string, ResolvedAspectOverride> = {};

    for (const row of stored) {
      const aspect = request.categoryAspects.find((candidate) => normalizeName(candidate.name) === row.aspect_key);
      // A learned value can go stale when eBay retires an allowed value, so it
      // is revalidated against the CURRENT allowed list on every read.
      const usable = aspect ? matchAspectValue(aspect, row.value) : row.value;
      if (!usable) {
        void this.markStale(request.marketplaceId, request.categoryId, row.aspect_key, row.value);
        continue;
      }

      const override: ResolvedAspectOverride = {
        value: usable,
        layer:
          row.source === AspectDefaultSource.CURATED
            ? AspectResolutionLayer.CURATED
            : AspectResolutionLayer.LEARNED,
      };

      if (row.is_override) {
        hardOverrides[row.aspect_key] = override;
      } else if (!overrides[row.aspect_key]) {
        overrides[row.aspect_key] = override;
      }
    }

    const specs = this.applyHardOverrides(request.product.specs, hardOverrides, request.categoryAspects);
    const buildInput = {
      title: request.product.title,
      brand: request.product.brand,
      specs,
      features: request.product.features,
      identifiers: request.product.identifiers,
      categoryAspects: request.categoryAspects,
      forcedAspectNames: request.forcedAspectNames,
    };

    // Pass 1: everything the deterministic layers can answer. `allowTerminalFallback`
    // is off so the aspects a model could still improve are visible as unresolved
    // instead of already filled with a broad value.
    const deterministic = buildAspectResolution({ ...buildInput, overrides, allowTerminalFallback: false });

    const llmOverrides = await this.resolveWithLlm(request, deterministic.unresolvedRequired);
    if (Object.keys(llmOverrides).length === 0) {
      // Nothing to add — re-run with the guarantee back on.
      return buildAspectResolution({ ...buildInput, overrides });
    }

    // Pass 2: same pure builder, now with the model's picks in the override map.
    return buildAspectResolution({
      ...buildInput,
      overrides: { ...overrides, ...llmOverrides },
    });
  }

  /**
   * Ask the model only about required aspects nothing else could fill.
   *
   * Bounded twice: by the platform-setting ceiling per listing and by the fact
   * that a chosen value is written back as a learned default, so the same
   * (category, aspect) question is asked once and then never again.
   */
  private async resolveWithLlm(
    request: AspectResolveRequest,
    unresolved: string[]
  ): Promise<Record<string, ResolvedAspectOverride>> {
    if (unresolved.length === 0 || !(await this.aspectLlm.isEnabled())) {
      return {};
    }

    const limit = await this.aspectLlm.maxAspectsPerListing();
    if (limit <= 0) {
      return {};
    }

    const targets = request.categoryAspects
      .filter((aspect) => unresolved.includes(aspect.name))
      .slice(0, limit);

    const results = await Promise.all(
      targets.map(async (aspect) => ({
        aspect,
        value: await this.aspectLlm.chooseValue({
          aspect,
          productTitle: request.product.title,
          productFeatures: request.product.features,
        }),
      }))
    );

    const overrides: Record<string, ResolvedAspectOverride> = {};
    for (const result of results) {
      if (!result.value) {
        continue;
      }
      overrides[normalizeName(result.aspect.name)] = {
        value: result.value,
        layer: AspectResolutionLayer.LLM,
      };
      // Learn it now: the answer is category-level, not product-level.
      void this.upsertLearned(
        request.marketplaceId,
        request.categoryId,
        result.aspect.name,
        result.value,
        AspectResolutionLayer.LLM
      ).catch(() => undefined);
    }

    return overrides;
  }

  /**
   * Persist the values that published successfully.
   *
   * Fire-and-forget and fail-soft: learning is an optimization, never a reason
   * to fail a listing that eBay already accepted.
   */
  recordPublishSuccess(marketplaceId: string, categoryId: string, resolution: AspectResolution): void {
    const learnable = resolution.decisions.filter(
      (decision) =>
        decision.value &&
        decision.required &&
        // Product data is per-product, so it teaches nothing about the category.
        decision.layer !== AspectResolutionLayer.PRODUCT_DATA &&
        decision.layer !== AspectResolutionLayer.CURATED
    );

    for (const decision of learnable) {
      void this.upsertLearned(marketplaceId, categoryId, decision.aspectName, decision.value!, decision.layer).catch(
        (error: unknown) => {
          this.logger.warn(
            `Could not record learned aspect ${decision.aspectName}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      );
    }
  }

  /**
   * eBay refused a value we supplied. Demote it so the next listing in this
   * category does not repeat the same rejected answer.
   */
  recordAspectRejection(marketplaceId: string, categoryId: string, aspectName: string, value: string): void {
    void this.databaseService
      .query(
        `UPDATE ebay_aspect_defaults
         SET failure_count = failure_count + 1,
             confidence = GREATEST(0, confidence - 20),
             stale_at = CASE WHEN confidence - 20 <= 0 THEN CURRENT_TIMESTAMP ELSE stale_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE marketplace_id = $1 AND category_id = $2 AND aspect_key = $3 AND value = $4`,
        [marketplaceId, categoryId, normalizeName(aspectName), value]
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not demote rejected aspect ${aspectName}: ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }

  // --------------------------------------------------------------- internals

  /** Curated hard overrides win over scraped product data, so inject them as specs. */
  private applyHardOverrides(
    specs: Record<string, string> | undefined,
    hardOverrides: Record<string, ResolvedAspectOverride>,
    categoryAspects: CategoryAspect[]
  ): Record<string, string> {
    const merged = { ...(specs ?? {}) };
    for (const [key, override] of Object.entries(hardOverrides)) {
      const aspect = categoryAspects.find((candidate) => normalizeName(candidate.name) === key);
      if (aspect) {
        merged[aspect.name] = override.value;
      }
    }
    return merged;
  }

  private async loadDefaults(marketplaceId: string, categoryId: string): Promise<AspectDefaultEntity[]> {
    try {
      // One row per aspect: the curated value if there is one, otherwise the
      // learned value with the strongest publish history.
      return await this.databaseService.query<AspectDefaultEntity>(
        `SELECT DISTINCT ON (aspect_key)
                aspect_key, aspect_name, value, source, is_override, confidence, success_count
         FROM ebay_aspect_defaults
         WHERE marketplace_id = $1 AND category_id = $2 AND stale_at IS NULL
         ORDER BY aspect_key,
                  (source = 'curated') DESC,
                  success_count DESC,
                  confidence DESC,
                  last_used_at DESC NULLS LAST`,
        [marketplaceId, categoryId]
      );
    } catch (error: unknown) {
      // A missing table or a DB hiccup must not stop a listing: the pure layers
      // still produce a complete, publishable aspect map on their own.
      this.logger.warn(
        `Aspect defaults unavailable for category ${categoryId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  private async upsertLearned(
    marketplaceId: string,
    categoryId: string,
    aspectName: string,
    value: string,
    layer: AspectResolutionLayer
  ): Promise<void> {
    // Single statement: no read-modify-write, so concurrent workers publishing
    // in the same category cannot lose an increment.
    await this.databaseService.query(
      `INSERT INTO ebay_aspect_defaults
         (marketplace_id, category_id, aspect_key, aspect_name, value,
          source, origin_layer, confidence, use_count, success_count, last_used_at)
       VALUES ($1, $2, $3, $4, $5, 'learned', $6, 55, 1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (marketplace_id, category_id, aspect_key, value) WHERE source = 'learned'
       DO UPDATE SET
         use_count = ebay_aspect_defaults.use_count + 1,
         success_count = ebay_aspect_defaults.success_count + 1,
         confidence = LEAST(100, ebay_aspect_defaults.confidence + 5),
         stale_at = NULL,
         last_used_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [marketplaceId, categoryId, normalizeName(aspectName), aspectName, value, layer]
    );
  }

  private async markStale(
    marketplaceId: string,
    categoryId: string,
    aspectKey: string,
    value: string
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `UPDATE ebay_aspect_defaults
         SET stale_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE marketplace_id = $1 AND category_id = $2 AND aspect_key = $3 AND value = $4`,
        [marketplaceId, categoryId, aspectKey, value]
      );
    } catch {
      // Best effort — the value was already skipped for this listing.
    }
  }
}
