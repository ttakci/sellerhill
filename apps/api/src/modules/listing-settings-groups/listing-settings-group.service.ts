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
    await this.ensureTablesExist();
    await this.seedPredefinedTemplates();
  }

  /**
   * Ensure listing_settings_groups and predefined_templates tables exist
   */
  private async ensureTablesExist() {
    this.logger.log('Ensuring listing_settings_groups table exists...');

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS listing_settings_groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        repricing_strategy JSONB NOT NULL,
        stock JSONB NOT NULL,
        fees JSONB NOT NULL,
        templates JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID NOT NULL,
        updated_by UUID NOT NULL
      )
    `);

    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_listing_settings_groups_user_id ON listing_settings_groups(user_id);
      CREATE INDEX IF NOT EXISTS idx_listing_settings_groups_created_by ON listing_settings_groups(created_by);
    `);

    this.logger.log('Ensuring predefined_templates table exists...');

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS predefined_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        html_content TEXT NOT NULL,
        sample_data JSONB NOT NULL DEFAULT '{}',
        preview_image VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add sample_data column if it doesn't exist (for existing databases)
    await this.databaseService.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='predefined_templates' AND column_name='sample_data') THEN
          ALTER TABLE predefined_templates ADD COLUMN sample_data JSONB NOT NULL DEFAULT '{}';
        END IF;
      END $$;
    `);
  }

  /**
   * Seed predefined templates if they don't exist
   */
  private async seedPredefinedTemplates() {
    const existingTemplates = await this.databaseService.query<PredefinedTemplateEntity>(`
      SELECT COUNT(*) as count FROM predefined_templates
    `);

    if (existingTemplates[0] && (existingTemplates[0] as any).count > 0) {
      this.logger.log('Predefined templates already exist, skipping seed.');
      return;
    }

    this.logger.log('Seeding predefined templates...');

    const templates = [
      {
        name: 'Modern Minimalist',
        description: 'Clean and professional design with focus on product details',
        htmlContent: `
          <div class="listing-container">
            <h1>{{product_title}}</h1>
            <div class="product-image">
              <img src="{{product_image}}" alt="{{product_title}}">
            </div>
            <div class="description">
              <h2>Product Description</h2>
              <p>{{product_description}}</p>
            </div>
            <div class="specifications">
              <h2>Specifications</h2>
              {{product_specs}}
            </div>
          </div>
          <style>
            .listing-container { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333; }
            h1 { font-size: 28px; }
            .product-image img { width: 100%; border-radius: 8px; }
            .description, .specifications { margin-top: 24px; }
          </style>
        `,
        sampleData: {
          product_title: 'Sample Premium Product',
          product_price: '299.99',
          product_image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800',
          product_description: 'This is a sample product description that showcases how your template will look in production.',
          product_specs: '<ul><li>High Quality Materials</li><li>Environmentally Friendly</li><li>2-Year Warranty</li></ul>'
        }
      },
      {
        name: 'Premium Electronics',
        description: 'High-end design for electronics with technical specifications',
        htmlContent: `
          <div class="premium-listing">
            <div class="header">
              <span class="badge">TOP RATED PLUS</span>
              <span class="badge new">NEW IN BOX</span>
            </div>
            <h1>{{product_title}}</h1>
            <div class="gallery">
              <img src="{{product_image}}" alt="{{product_title}}">
            </div>
            <div class="features">
              <h2>Key Features</h2>
              {{product_features}}
            </div>
            <div class="tech-specs">
              <h2>Technical Specifications</h2>
              {{product_specs}}
            </div>
            <div class="shipping-info">
              <p>✓ Fast & Free Shipping</p>
              <p>✓ 30-Day Returns</p>
              <p>✓ 1-Year Warranty</p>
            </div>
          </div>
          <style>
            .premium-listing { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; }
            .badge { background: #ffd700; color: #000; padding: 4px 12px; border-radius: 4px; margin-right: 8px; }
            .gallery img { width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
          </style>
        `,
        sampleData: {
          product_title: 'UltraSync Gamer Pro Z1',
          product_features: '<ul><li>4K 144Hz Display</li><li>RTX 4090 Inside</li><li>Liquid Cooling</li></ul>',
          product_specs: '<ul><li>CPU: Core i9-13900K</li><li>RAM: 64GB DDR5</li><li>SSD: 2TB NVMe</li></ul>'
        }
      },
      {
        name: 'E-commerce Classic',
        description: 'Traditional layout with clear sections and call-to-action',
        htmlContent: `
          <div class="classic-template">
            <div class="banner">
              <h1>{{product_title}}</h1>
              <p class="price">US {{product_price}}</p>
            </div>
            <div class="content">
              <div class="image-section">
                <img src="{{product_image}}" alt="{{product_title}}">
              </div>
              <div class="info-section">
                <h2>About This Item</h2>
                <p>{{product_description}}</p>
                <div class="cta">
                  <button>Buy It Now</button>
                  <button>Add to Cart</button>
                </div>
              </div>
            </div>
            <div class="footer">
              <p>Estimated delivery: {{delivery_date}}</p>
            </div>
          </div>
          <style>
            .classic-template { max-width: 1000px; margin: 0 auto; font-family: 'Helvetica Neue', sans-serif; }
            .banner { background: #f7f7f7; padding: 20px; text-align: center; }
            .content { display: flex; gap: 40px; margin-top: 20px; }
            .cta button { background: #3665f3; color: white; padding: 12px 24px; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer; }
          </style>
        `,
        sampleData: {
          product_title: 'Classic Leather Bag',
          product_price: '145.00',
          product_image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=800',
          product_description: 'Expertly crafted from genuine leather, this classic bag is perfect for daily use or travel.',
          delivery_date: 'Jan 25 - Jan 28'
        }
      }
    ];

    for (const template of templates as any[]) {
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
    const values: any[] = [];
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
      sampleData: typeof entity.sample_data === 'string' ? JSON.parse(entity.sample_data) : entity.sample_data,
      previewImage: entity.preview_image || undefined,
      createdAt: entity.created_at
    }));
  }

  /**
   * Map database entity to DTO
   */
  private mapToDto(entity: ListingSettingsGroupEntity): ListingSettingsGroupResponse {
    const repricingStrategy = typeof entity.repricing_strategy === 'string'
      ? JSON.parse(entity.repricing_strategy)
      : (entity.repricing_strategy as any as PriceRange[]);

    const stock = typeof entity.stock === 'string'
      ? JSON.parse(entity.stock)
      : (entity.stock as any as StockConfig);

    const fees = typeof entity.fees === 'string'
      ? JSON.parse(entity.fees)
      : (entity.fees as any as FeeConfig);

    const templates = typeof entity.templates === 'string'
      ? JSON.parse(entity.templates)
      : (entity.templates as any as TemplateConfig);

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
