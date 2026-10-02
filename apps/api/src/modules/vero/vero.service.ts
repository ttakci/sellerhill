import { Injectable, Logger } from '@nestjs/common';
import type { AddVeroKeywordsResult, AdminVeroKeywordDto, AdminVeroKeywordListDto } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import {
  compileVeroKeywords,
  findVeroMatch,
  parseVeroKeywords,
  type CompiledVeroKeyword,
} from './vero.helpers';

/** Replicas converge within this window after the operator edits the list. */
const CACHE_TTL_MS = 60_000;

interface VeroKeywordRow {
  id: string;
  keyword: string;
  created_at: Date;
}

/**
 * The platform VeRO list (`vero_keywords`, migration 138).
 *
 * Operator-owned and never shown to sellers: a seller sees only the on/off
 * switch in their listing rules and, on a refused product, the one brand that
 * matched. Matching reads the product's brand and manufacturer only — see
 * `findVeroMatch`.
 */
@Injectable()
export class VeroService {
  private readonly logger = new Logger(VeroService.name);
  private cache: { loadedAt: number; compiled: CompiledVeroKeyword[] } | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * The VeRO entry naming this brand / manufacturer, or null.
   *
   * Fails OPEN: a list that cannot be read refuses nothing. The list is a
   * protection layered on top of the seller's own blacklist, and a database
   * hiccup must not stop every seller from listing.
   */
  async findMatch(brandValues: ReadonlyArray<string | null | undefined>): Promise<string | null> {
    try {
      return findVeroMatch(await this.compiled(), brandValues);
    } catch (error: unknown) {
      this.logger.warn(`VeRO list unavailable — check skipped: ${error instanceof Error ? error.message : 'unknown'}`);
      return null;
    }
  }

  private async compiled(): Promise<CompiledVeroKeyword[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.compiled;
    }
    const rows = await this.databaseService.query<{ keyword: string }>(`SELECT keyword FROM vero_keywords`);
    const compiled = compileVeroKeywords(rows.map((row) => row.keyword));
    this.cache = { loadedAt: Date.now(), compiled };
    return compiled;
  }

  async list(query: { search?: string; page?: number; limit?: number }): Promise<AdminVeroKeywordListDto> {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(500, Math.max(1, Math.floor(query.limit ?? 100)));
    const search = query.search?.trim().toLowerCase() ?? '';
    // `%`, `_` and the backslash itself are LIKE syntax; escaped, the search is
    // a plain "contains".
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;

    const [{ count }] = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM vero_keywords WHERE $1 = '' OR LOWER(keyword) LIKE $2`,
      [search, pattern],
    );
    const rows = await this.databaseService.query<VeroKeywordRow>(
      `SELECT id, keyword, created_at
         FROM vero_keywords
        WHERE $1 = '' OR LOWER(keyword) LIKE $2
        ORDER BY LOWER(keyword) ASC
        LIMIT $3 OFFSET $4`,
      [search, pattern, limit, (page - 1) * limit],
    );
    return { items: rows.map((row) => this.toDto(row)), total: Number(count), page, limit };
  }

  async add(input: readonly string[], createdBy: string | null): Promise<AddVeroKeywordsResult> {
    const keywords = parseVeroKeywords(input);
    if (keywords.length === 0) {
      return { added: 0, skipped: 0 };
    }
    // One statement, race-safe: the unique index on LOWER(keyword) is the
    // arbiter, so two operators adding the same brand cannot both insert it.
    const inserted = await this.databaseService.query<{ id: string }>(
      `INSERT INTO vero_keywords (keyword, created_by)
       SELECT k, $2::uuid FROM unnest($1::text[]) AS k
       ON CONFLICT (LOWER(keyword)) DO NOTHING
       RETURNING id`,
      [keywords, createdBy],
    );
    this.cache = null;
    return { added: inserted.length, skipped: keywords.length - inserted.length };
  }

  async remove(id: string): Promise<void> {
    await this.databaseService.query(`DELETE FROM vero_keywords WHERE id = $1`, [id]);
    this.cache = null;
  }

  private toDto(row: VeroKeywordRow): AdminVeroKeywordDto {
    return { id: row.id, keyword: row.keyword, createdAt: new Date(row.created_at).toISOString() };
  }
}
