import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    DEFAULT_LISTING_CONTENT_CONFIG,
    type CreateListingSettingsGroupRequest,
    type FeeConfig,
    type ListingContentConfig,
    type ListingSettingsGroupResponse,
    type PredefinedTemplateResponse,
    type PriceRange,
    type StockConfig,
    type TemplateConfig,
    type UpdateListingSettingsGroupRequest
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

/**
 * Listing Settings Group Entity
 */
interface ListingSettingsGroupEntity {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  repricing_strategy: string; // JSON string in DB
  stock: string; // JSON string in DB
  fees: string; // JSON string in DB
  templates: string; // JSON string in DB
  content?: string | ListingContentConfig | null;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Predefined Template Entity
 *
 * Seeded by migrations `070`/`071`, not by this service. `slug` is the stable
 * natural key catalog migrations upsert on; `id` is referenced from
 * `listing_settings_groups.templates` JSONB with no foreign key and must never
 * be rewritten.
 */
interface PredefinedTemplateEntity {
  id: string;
  slug: string;
  name: string;
  description: string;
  html_content: string;
  sample_data: string; // JSON string in DB
  preview_image: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

/**
 * Predefined-template HTML cache TTL.
 *
 * Templates are catalog DATA owned by the database (migrations 070/071), not by
 * this service. The boot-time seed that used to upsert a hardcoded TS array on
 * every start is gone, and the unique index on `slug` structurally replaces the
 * duplicate self-heal it carried.
 *
 * Do NOT reintroduce a cache clear() here: the only ways html_content changes
 * now are a migration (which implies a new process with an empty cache) or a
 * manual DB edit (covered by this TTL).
 */
const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ListingSettingsGroupService {
  private readonly templateHtmlCache = new Map<string, { html: string; expiresAt: number }>();

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get all listing settings groups for a user
   */
  async getListingSettingsGroups(userId: string): Promise<ListingSettingsGroupResponse[]> {
    const query = `SELECT * FROM listing_settings_groups WHERE user_id = $1 ORDER BY updated_at DESC`;

    const results = await this.databaseService.query<ListingSettingsGroupEntity>(query, [userId]);

    return results.map(entity => this.mapToDto(entity));
  }

  /**
   * Get a single listing settings group by ID
   */
  async getListingSettingsGroupById(userId: string, id: string): Promise<ListingSettingsGroupResponse> {
    const results = await this.databaseService.query<ListingSettingsGroupEntity>(
      `SELECT * FROM listing_settings_groups WHERE id = $1`,
      [id]
    );

    if (results.length === 0) {
      throw new NotFoundException('Listing settings group not found');
    }

    const group = results[0];

    if (group.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToDto(group);
  }

  /**
   * Create a new listing settings group
   */
  async createListingSettingsGroup(userId: string, dto: CreateListingSettingsGroupRequest): Promise<ListingSettingsGroupResponse> {
    const repricingStrategyJson = JSON.stringify(dto.repricingStrategy);
    const stockJson = JSON.stringify(dto.stock);
    const feesJson = JSON.stringify(dto.fees);
    const templatesJson = JSON.stringify(dto.templates);
    const contentJson = JSON.stringify({
      ...DEFAULT_LISTING_CONTENT_CONFIG,
      ...(dto.content ?? {}),
    });

    const results = await this.databaseService.query<ListingSettingsGroupEntity>(`
      INSERT INTO listing_settings_groups (
        user_id, name, description, repricing_strategy, stock, fees, templates, content, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      userId,
      dto.name,
      dto.description || null,
      repricingStrategyJson,
      stockJson,
      feesJson,
      templatesJson,
      contentJson,
      userId,
      userId
    ]);

    return this.mapToDto(results[0]);
  }

  /**
   * Update an existing listing settings group
   */
  async updateListingSettingsGroup(userId: string, id: string, dto: UpdateListingSettingsGroupRequest): Promise<ListingSettingsGroupResponse> {
    // First check if group exists and user owns it
    await this.getListingSettingsGroupById(userId, id);

    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }

    if (dto.repricingStrategy !== undefined) {
      updates.push(`repricing_strategy = $${paramIndex++}`);
      values.push(JSON.stringify(dto.repricingStrategy));
    }

    if (dto.stock !== undefined) {
      updates.push(`stock = $${paramIndex++}`);
      values.push(JSON.stringify(dto.stock));
    }

    if (dto.fees !== undefined) {
      updates.push(`fees = $${paramIndex++}`);
      values.push(JSON.stringify(dto.fees));
    }

    if (dto.templates !== undefined) {
      updates.push(`templates = $${paramIndex++}`);
      values.push(JSON.stringify(dto.templates));
    }

    if (dto.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(JSON.stringify({ ...DEFAULT_LISTING_CONTENT_CONFIG, ...dto.content }));
    }

    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);

    const results = await this.databaseService.query<ListingSettingsGroupEntity>(`
      UPDATE listing_settings_groups
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return this.mapToDto(results[0]);
  }

  /**
   * Delete a listing settings group
   */
  async deleteListingSettingsGroup(userId: string, id: string): Promise<{ success: boolean }> {
    // First check if group exists and user owns it
    await this.getListingSettingsGroupById(userId, id);

    await this.databaseService.query(
      `DELETE FROM listing_settings_groups WHERE id = $1`,
      [id]
    );

    return { success: true };
  }

  /**
   * Resolve a predefined template's HTML for the listing create path.
   *
   * Cached in-process (short TTL): the listings worker renders one description
   * per ASIN and templates change rarely, so a bulk add of 500 ASINs must not
   * become 500 identical SELECTs. Returns null when the id no longer exists —
   * the caller falls back to the default template rather than publishing an
   * empty description.
   *
   * Deliberately does NOT filter on `is_active`. Retiring a template hides it
   * from the picker; it must keep resolving here, or every listing already
   * configured with it would silently downgrade to DEFAULT_LISTING_TEMPLATE_HTML.
   */
  async getPredefinedTemplateHtml(id: string): Promise<string | null> {
    const cached = this.templateHtmlCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.html;
    }

    const results = await this.databaseService.query<{ html_content: string }>(
      `SELECT html_content FROM predefined_templates WHERE id = $1`,
      [id]
    );
    const html = results[0]?.html_content ?? null;
    if (html !== null) {
      this.templateHtmlCache.set(id, { html, expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS });
    }
    return html;
  }

  /**
   * Get the selectable predefined templates (settings-drawer picker).
   *
   * Ordered by `sort_order`, not `created_at`: catalog rows adopted by migration
   * `070` keep their original timestamps while every row a catalog migration
   * inserts shares one NOW(), so created_at ordering would make the picker's
   * order an artifact of seed history.
   */
  async getPredefinedTemplates(): Promise<PredefinedTemplateResponse[]> {
    const results = await this.databaseService.query<PredefinedTemplateEntity>(
      `SELECT id, slug, name, description, html_content, sample_data, preview_image, created_at
       FROM predefined_templates
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );

    return results.map(entity => ({
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      description: entity.description,
      htmlContent: entity.html_content,
      sampleData: typeof entity.sample_data === 'string'
        ? (JSON.parse(entity.sample_data) as Record<string, string | string[]>)
        : (entity.sample_data as unknown as Record<string, string | string[]>),
      previewImage: entity.preview_image || undefined,
      createdAt: entity.created_at
    }));
  }

  /**
   * Map database entity to DTO
   */
  private mapToDto(entity: ListingSettingsGroupEntity): ListingSettingsGroupResponse {
    const repricingStrategy = typeof entity.repricing_strategy === 'string'
      ? (JSON.parse(entity.repricing_strategy) as PriceRange[])
      : (entity.repricing_strategy as unknown as PriceRange[]);

    const stock = typeof entity.stock === 'string'
      ? (JSON.parse(entity.stock) as StockConfig)
      : (entity.stock as unknown as StockConfig);

    const fees = typeof entity.fees === 'string'
      ? (JSON.parse(entity.fees) as FeeConfig)
      : (entity.fees as unknown as FeeConfig);

    const templates = typeof entity.templates === 'string'
      ? (JSON.parse(entity.templates) as TemplateConfig)
      : (entity.templates as unknown as TemplateConfig);

    let content: ListingContentConfig = { ...DEFAULT_LISTING_CONTENT_CONFIG };
    if (entity.content) {
      const parsed =
        typeof entity.content === 'string'
          ? (JSON.parse(entity.content) as Partial<ListingContentConfig>)
          : (entity.content as Partial<ListingContentConfig>);
      content = { ...DEFAULT_LISTING_CONTENT_CONFIG, ...parsed };
    }

    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || undefined,
      repricingStrategy,
      stock,
      fees,
      templates,
      content,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      createdBy: entity.created_by,
      updatedBy: entity.updated_by
    };
  }
}
