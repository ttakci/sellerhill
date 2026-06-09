import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
    type CreateListingSettingsGroupRequest,
    type FeeConfig,
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
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Predefined Template Entity
 */
interface PredefinedTemplateEntity {
  id: string;
  name: string;
  description: string;
  html_content: string;
  sample_data: string; // JSON string in DB
  preview_image: string | null;
  created_at: Date;
}

@Injectable()
export class ListingSettingsGroupService implements OnModuleInit {
  private readonly logger = new Logger(ListingSettingsGroupService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.seedPredefinedTemplates();
  }

  /**
   * Seed predefined templates if they don't exist
   */
  private async seedPredefinedTemplates() {
    const existingTemplates = await this.databaseService.query<PredefinedTemplateEntity>(`
      SELECT COUNT(*) as count FROM predefined_templates
    `);

    if (existingTemplates[0] && (existingTemplates[0] as unknown as { count: number }).count > 0) {
      // Check if we need to refresh (e.g. if specific v2 template name exists)
      const v2Check = await this.databaseService.query(`
        SELECT id FROM predefined_templates WHERE name = 'Elite Trust'
      `);
      
      if (v2Check.length > 0) {
        this.logger.log('Predefined templates already exist and are up to date.');
        return;
      }

      this.logger.log('Refreshing predefined templates to v2...');
      await this.databaseService.query(`DELETE FROM predefined_templates`);
    }

    this.logger.log('Seeding predefined templates...');

    const templates = [
      {
        name: 'Modern Professional',
        description: 'Clean typography and professional two-column layout for high-end products',
        htmlContent: `
<div class="zonds-listing">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Outfit:300,400,600,700">
  <div class="zonds-content">
    <h1 class="zonds-title">{{title}}</h1>
    <div class="zonds-grid">
      <div class="zonds-image-col">
        <div class="zonds-image-box">
          <img src="{{main_image}}" alt="{{title}}">
        </div>
      </div>
      <div class="zonds-details-col">
        <div class="zonds-section">
          <h2 class="zonds-section-title">Product Details</h2>
          <ul class="zonds-list">
            {{#product_details}}
            <li>{{.}}</li>
            {{/product_details}}
          </ul>
        </div>
        <div class="zonds-section">
          <h2 class="zonds-section-title">Key Features</h2>
          <ul class="zonds-list">
            {{#feature_bullets}}
            <li>{{.}}</li>
            {{/feature_bullets}}
          </ul>
        </div>
      </div>
    </div>
    <div class="zonds-description">
      <h2 class="zonds-section-title">Full Description</h2>
      <p>{{{product_description}}}</p>
    </div>
  </div>
</div>
<style>
.zonds-listing { font-family: 'Outfit', sans-serif; color: #1e293b; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 20px; }
.zonds-title { font-size: 32px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 32px; }
.zonds-grid { display: flex; gap: 40px; margin-bottom: 40px; }
.zonds-image-col { flex: 1; max-width: 450px; }
.zonds-details-col { flex: 1.2; }
.zonds-image-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
.zonds-image-box img { max-width: 100%; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.zonds-section-title { font-size: 18px; font-weight: 600; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; border-left: 4px solid #3b82f6; padding-left: 12px; }
.zonds-list { list-style: none; padding: 0; }
.zonds-list li { margin-bottom: 8px; position: relative; padding-left: 20px; }
.zonds-list li::before { content: "•"; color: #3b82f6; position: absolute; left: 0; font-weight: bold; }
.zonds-description { background: #f1f5f9; padding: 32px; border-radius: 12px; margin-top: 40px; }
@media (max-width: 768px) { .zonds-grid { flex-direction: column; } .zonds-image-col { max-width: 100%; } }
</style>
        `,
        sampleData: {
          title: 'Premium Wireless Noise Cancelling Headphones - Silver Edition',
          main_image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
          product_description: 'Experience world-class noise cancellation and premium sound quality with these high-end wireless headphones. Perfect for travel, work, or pure listening pleasure.',
          feature_bullets: ['Industry-leading noise cancellation', 'Up to 30-hour battery life', 'Touch sensor controls', 'Quick attention mode'],
          product_details: ['Brand: Zonds Audio', 'Connectivity: Bluetooth 5.0', 'Noise Cancelling: Yes', 'Color: Silver']
        }
      },
      {
        name: 'Elite Trust',
        description: 'Focus on shipping, returns, and buyer confidence with clear policy blocks',
        htmlContent: `
<div class="elite-wrapper">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter:400,600,700">
  <div class="elite-header">
    <h1>{{title}}</h1>
  </div>
  <div class="elite-main">
    <div class="elite-image-center">
      <img src="{{main_image}}" alt="{{title}}">
    </div>
    <div class="elite-container">
      <div class="elite-section">
        <h3><span class="elite-icon">📋</span> Product Overview</h3>
        <p>{{{product_description}}}</p>
        <ul class="elite-features">
          {{#feature_bullets}}
          <li>{{.}}</li>
          {{/feature_bullets}}
        </ul>
      </div>
      <div class="elite-policies">
        <div class="elite-policy-item">
          <h4><span class="elite-icon">🚚</span> Fast Handling</h4>
          <p>We process all orders within <strong>24-48 hours</strong> of payment confirmation.</p>
        </div>
        <div class="elite-policy-item">
          <h4><span class="elite-icon">📦</span> Secure Delivery</h4>
          <p>Orders are shipped with premium tracking. Continental US shipping only.</p>
        </div>
        <div class="elite-policy-item">
          <h4><span class="elite-icon">🛡️</span> 30-Day Guarantee</h4>
          <p>Not satisfied? Return within 30 days for a full refund. Peace of mind guaranteed.</p>
        </div>
        <div class="elite-policy-item">
          <h4><span class="elite-icon">⭐</span> Reliable Feedback</h4>
          <p>Our reputation is based on trust. Contact us first if you have any issues with your order.</p>
        </div>
      </div>
    </div>
  </div>
</div>
<style>
.elite-wrapper { font-family: 'Inter', sans-serif; background: #fff; max-width: 900px; margin: 0 auto; color: #2d3748; }
.elite-header { background: #1a202c; color: #fff; padding: 40px 20px; text-align: center; }
.elite-header h1 { font-size: 24px; margin: 0; max-width: 800px; margin: 0 auto; line-height: 1.4; }
.elite-main { padding: 40px 20px; }
.elite-image-center { text-align: center; margin-bottom: 40px; }
.elite-image-center img { max-width: 500px; border: 1px solid #edf2f7; border-radius: 8px; }
.elite-container { display: grid; grid-template-columns: 1fr 300px; gap: 40px; }
.elite-section h3 { font-size: 18px; margin-top: 0; padding-bottom: 12px; border-bottom: 1px solid #edf2f7; }
.elite-features { padding-left: 20px; margin-top: 20px; }
.elite-features li { margin-bottom: 10px; }
.elite-policies { background: #f7fafc; padding: 24px; border-radius: 8px; }
.elite-policy-item { margin-bottom: 24px; }
.elite-policy-item:last-child { margin-bottom: 0; }
.elite-policy-item h4 { margin: 0 0 8px 0; display: flex; align-items: center; font-size: 14px; text-transform: uppercase; color: #4a5568; }
.elite-policy-item p { font-size: 13px; margin: 0; color: #718096; }
.elite-icon { margin-right: 8px; font-size: 18px; }
@media (max-width: 768px) { .elite-container { grid-template-columns: 1fr; } }
</style>
        `,
        sampleData: {
          title: 'EliteBook X360 1040 G8 Laptop - 14" Touchscreen, Core i7, 16GB RAM, 512GB SSD',
          main_image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=1000',
          product_description: 'Experience professional performance with the EliteBook X360. This versatile 2-in-1 laptop features a stunning 14-inch touchscreen and powerful internals for maximum productivity.',
          feature_bullets: [
            '11th Gen Intel Core i7 processor for blazing fast speeds',
            '16GB High-Speed RAM for seamless multitasking',
            '512GB NVMe SSD storage for instant boot times',
            '14-inch Full HD x360 Touchscreen display',
            'Backlit Keyboard and Fingerprint reader for security'
          ],
          product_details: [
            'Brand: HP',
            'Model: EliteBook X360 1040 G8',
            'Processor: Intel Core i7-1185G7',
            'Operating System: Windows 11 Pro',
            'Color: Silver'
          ]
        }
      }
    ];

    for (const template of templates) {
      await this.databaseService.query(`
        INSERT INTO predefined_templates (name, description, html_content, sample_data)
        VALUES ($1, $2, $3, $4)
      `, [template.name, template.description, template.htmlContent, JSON.stringify(template.sampleData)]);
    }

    this.logger.log('Predefined templates seeded successfully.');
  }

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

    const results = await this.databaseService.query<ListingSettingsGroupEntity>(`
      INSERT INTO listing_settings_groups (
        user_id, name, description, repricing_strategy, stock, fees, templates, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      userId,
      dto.name,
      dto.description || null,
      repricingStrategyJson,
      stockJson,
      feesJson,
      templatesJson,
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
   * Get all predefined templates
   */
  async getPredefinedTemplates(): Promise<PredefinedTemplateResponse[]> {
    const results = await this.databaseService.query<PredefinedTemplateEntity>(
      `SELECT * FROM predefined_templates ORDER BY created_at ASC`
    );

    return results.map(entity => ({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      htmlContent: entity.html_content,
      sampleData: typeof entity.sample_data === 'string' ? (JSON.parse(entity.sample_data) as Record<string, string>) : (entity.sample_data as unknown as Record<string, string>),
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

    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || undefined,
      repricingStrategy,
      stock,
      fees,
      templates,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
      createdBy: entity.created_by,
      updatedBy: entity.updated_by
    };
  }
}
