/**
 * Admin view over eBay item-specifics intelligence.
 *
 * The values that fill required item specifics come from three places: the
 * product data, what the platform learned from successful publishes, and what
 * an operator curated. Only the last one is editable, and only from here —
 * customers never see category-level defaults, because the learning is shared
 * across all of them.
 */

export enum AspectDefaultSourceDto {
  CURATED = 'curated',
  LEARNED = 'learned',
}

export interface AdminAspectDefaultDto {
  id: string;
  marketplaceId: string;
  categoryId: string;
  aspectName: string;
  value: string;
  source: AspectDefaultSourceDto;
  /** Which layer originally produced the value (prior, llm, terminal_fallback…). */
  originLayer: string;
  /** Curated overrides outrank scraped product data. */
  isOverride: boolean;
  confidence: number;
  useCount: number;
  successCount: number;
  failureCount: number;
  /** Set when eBay stopped accepting the value. */
  staleAt: string | null;
  lastUsedAt: string | null;
  updatedAt: string;
}

export interface AdminAspectDefaultsListDto {
  generatedAt: string;
  items: AdminAspectDefaultDto[];
  total: number;
  page: number;
  limit: number;
}

export interface UpsertAspectDefaultRequest {
  marketplaceId: string;
  categoryId: string;
  aspectName: string;
  value: string;
  /** True makes it beat scraped product data, not just the fallbacks. */
  isOverride?: boolean;
}

/** One row of "how did item specifics get filled lately". */
export interface AdminAspectCoverageRowDto {
  categoryId: string;
  layer: string;
  aspectCount: number;
  listingCount: number;
}

export interface AdminListingQualitySummaryDto {
  generatedAt: string;
  periodDays: number;
  /** Listings created in the period that carry an aspect audit. */
  listingsAnalyzed: number;
  /** Listings with at least one specific filled by the terminal fallback. */
  listingsWithAutofill: number;
  /** Average item specifics published per listing — the headline quality number. */
  averageSpecifics: number;
  coverage: AdminAspectCoverageRowDto[];
  /** Categories where the fallback fires most — the curation worklist. */
  topFallbackCategories: Array<{ categoryId: string; listingCount: number }>;
}

export interface AdminCategoryMappingDto {
  id: string;
  marketplaceId: string;
  scope: string;
  scopeKey: string;
  categoryId: string;
  categoryName: string;
  source: string;
  isLocked: boolean;
  hitCount: number;
  lastUsedAt: string | null;
}
