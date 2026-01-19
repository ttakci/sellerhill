import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ListingJobStatus,
  ListingStatus,
  type CreateListingsRequest,
  type ListingDto,
  type ListingJobDto,
  type ListingJobItemDto,
  type ProductData,
} from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';
import { EbayService } from '../ebay/ebay.service';
import { ListingJobEntity, ListingJobItemEntity } from './listings.entities';

@Injectable()
export class ListingsService implements OnModuleInit {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayService: EbayService,
  ) {}

  async onModuleInit() {
    await this.ensureTablesExist();
  }

  /**
   * Ensure listings tables exist
   */
  private async ensureTablesExist() {
    this.logger.log('Ensuring listings tables exist...');

    // Create system_config table
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        description VARCHAR(200),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default config if not exists
    await this.databaseService.query(`
      INSERT INTO system_config (key, value, description)
      VALUES ('product_sync_interval_days', '7', 'Days between product data syncs')
      ON CONFLICT (key) DO NOTHING
    `);

    // Create products table
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        asin VARCHAR(10) UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        price JSONB NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        image_urls JSONB NOT NULL,
        brand VARCHAR(200),
        category VARCHAR(200),
        features JSONB,
        raw_provider_data JSONB,
        last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create listing_jobs table
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS listing_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_asins INT NOT NULL,
        processed_count INT DEFAULT 0,
        success_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create listing_job_items table
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS listing_job_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        job_id UUID NOT NULL REFERENCES listing_jobs(id) ON DELETE CASCADE,
        asin VARCHAR(10) NOT NULL,
        product_id UUID REFERENCES products(id),
        listing_id UUID,
        status VARCHAR(20) DEFAULT 'draft',
        ebay_item_id VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create listings table (Final active listings)
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asin VARCHAR(10) NOT NULL,
        product_id UUID NOT NULL REFERENCES products(id),
        listing_settings_group_id UUID NOT NULL REFERENCES listing_settings_groups(id),
        ebay_item_id VARCHAR(50) UNIQUE NOT NULL,
        payment_policy_id VARCHAR(50),
        shipping_policy_id VARCHAR(50),
        return_policy_id VARCHAR(50),
        title TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin);
      CREATE INDEX IF NOT EXISTS idx_products_last_sync ON products(last_sync_at);
      CREATE INDEX IF NOT EXISTS idx_listing_jobs_user_id ON listing_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_listing_jobs_status ON listing_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_listing_job_items_job_id ON listing_job_items(job_id);
      CREATE INDEX IF NOT EXISTS idx_listing_job_items_asin ON listing_job_items(asin);
      CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
      CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);
    `);

    // Migration: Add policy columns if missing (PostgreSQL specific)
    try {
      // Products migration
      await this.databaseService.query(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS raw_provider_data JSONB;
      `);

      // Listings migration
      await this.databaseService.query(`
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS payment_policy_id VARCHAR(50);
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_policy_id VARCHAR(50);
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS return_policy_id VARCHAR(50);
      `);
    } catch (e) {
      this.logger.warn('Failed to run migration for columns (might be normal if db not postgres or already exists)', e);
    }
  }

  /**
   * Create a final listing record after successful eBay creation
   */
  async createListing(data: {
    userId: string;
    asin: string;
    productId: string;
    listingSettingsGroupId: string;
    paymentPolicyId: string;
    shippingPolicyId: string;
    returnPolicyId: string;
    ebayItemId: string;
    title: string;
    price: number;
    quantity: number;
  }): Promise<string> {
    const result = await this.databaseService.query<{ id: string }>(`
      INSERT INTO listings (
        user_id, asin, product_id, listing_settings_group_id, 
        payment_policy_id, shipping_policy_id, return_policy_id,
        ebay_item_id, title, price, quantity, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
      RETURNING id
    `, [
      data.userId,
      data.asin,
      data.productId,
      data.listingSettingsGroupId,
      data.paymentPolicyId,
      data.shippingPolicyId,
      data.returnPolicyId,
      data.ebayItemId,
      data.title,
      data.price,
      data.quantity,
    ]);

    return result[0].id;
  }

  /**
   * Get all listings for a user
   */
  async getListings(userId: string): Promise<ListingDto[]> {
    const results = await this.databaseService.query(`
      SELECT l.*, p.image_urls
      FROM listings l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
    `, [userId]);

    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      asin: row.asin,
      productId: row.product_id,
      title: row.title,
      price: parseFloat(row.price),
      quantity: row.quantity,
      imageUrls: row.image_urls || [],
      ebayListingId: row.ebay_item_id,
      listingSettingsGroupId: row.listing_settings_group_id,
      status: row.status as ListingStatus,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      paymentPolicyId: row.payment_policy_id || '', 
      shippingPolicyId: row.shipping_policy_id || '',
      returnPolicyId: row.return_policy_id || '',
    }));
  }

  /**
   * Get a single listing by ID
   */
  async getListing(userId: string, id: string): Promise<ListingDto | null> {
    const results = await this.databaseService.query(`
      SELECT l.*, p.image_urls
      FROM listings l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.id = $1 AND l.user_id = $2
    `, [id, userId]);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      userId: row.user_id,
      asin: row.asin,
      productId: row.product_id,
      title: row.title,
      price: parseFloat(row.price),
      quantity: row.quantity,
      imageUrls: row.image_urls || [],
      ebayListingId: row.ebay_item_id,
      listingSettingsGroupId: row.listing_settings_group_id,
      status: row.status as ListingStatus,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      paymentPolicyId: row.payment_policy_id || '',
      shippingPolicyId: row.shipping_policy_id || '',
      returnPolicyId: row.return_policy_id || '',
    };
  }

  /**
   * Get cached product info by ASIN
   */
  async getProductByAsin(asin: string): Promise<ProductData | null> {
    const results = await this.databaseService.query(`
      SELECT * FROM products WHERE asin = $1
    `, [asin]);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];

    // If we have raw_provider_data (full ScraperAPI response), use it as it's more complete
    if (row.raw_provider_data) {
      return typeof row.raw_provider_data === 'string' 
        ? JSON.parse(row.raw_provider_data) 
        : row.raw_provider_data;
    }

    return {
      asin: row.asin,
      title: row.title,
      description: row.description,
      price: {
        current: typeof row.price === 'string' ? JSON.parse(row.price).current : row.price.current,
        avg30: typeof row.price === 'string' ? JSON.parse(row.price).avg30 || 0 : row.price.avg30 || 0,
        currency: row.currency || 'USD',
      },
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls : JSON.parse(row.image_urls),
      brand: row.brand,
      category: row.category,
      manufacturer: row.brand, // Fallback
      features: [],
    };
  }

  /**
   * Create a new listing job
   */
  async createJob(
    userId: string,
    request: CreateListingsRequest,
  ): Promise<ListingJobDto> {
    const { asins } = request;

    // Create job record
    const jobResult = await this.databaseService.query<ListingJobEntity>(`
      INSERT INTO listing_jobs (user_id, total_asins, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, asins.length, ListingJobStatus.PENDING]);

    const job = jobResult[0];

    // Create job items for each ASIN
    for (const asin of asins) {
      await this.databaseService.query(`
        INSERT INTO listing_job_items (job_id, asin, status)
        VALUES ($1, $2, $3)
      `, [job.id, asin, ListingStatus.DRAFT]);
    }

    // TODO: Queue the job for processing
    // await this.queueService.addListingJob(job.id, userId, request);

    return this.mapJobToDto(job);
  }

  /**
   * Get job status
   */
  async getJobStatus(userId: string, jobId: string): Promise<ListingJobDto | null> {
    const results = await this.databaseService.query<ListingJobEntity>(`
      SELECT * FROM listing_jobs
      WHERE id = $1 AND user_id = $2
    `, [jobId, userId]);

    if (results.length === 0) {
      return null;
    }

    return this.mapJobToDto(results[0]);
  }

  /**
   * Get all listing jobs for a user
   */
  async getJobs(userId: string): Promise<ListingJobDto[]> {
    const results = await this.databaseService.query<ListingJobEntity>(`
      SELECT * FROM listing_jobs
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    return results.map(row => this.mapJobToDto(row));
  }

  /**
   * Get job items
   */
  async getJobItems(userId: string, jobId: string): Promise<ListingJobItemDto[]> {
    // Verify job belongs to user
    const jobCheck = await this.databaseService.query(`
      SELECT id FROM listing_jobs WHERE id = $1 AND user_id = $2
    `, [jobId, userId]);

    if (jobCheck.length === 0) {
      return [];
    }

    const items = await this.databaseService.query<ListingJobItemEntity>(`
      SELECT * FROM listing_job_items
      WHERE job_id = $1
      ORDER BY created_at ASC
    `, [jobId]);

    return items.map(item => this.mapJobItemToDto(item));
  }

  /**
   * Find product by ASIN or create it using ScraperAPI data
   */
  async findOrCreateProduct(asin: string, productData: ProductData): Promise<string> {
    const existing = await this.databaseService.query<{ id: string }>(`
      SELECT id FROM products WHERE asin = $1
    `, [asin]);

    if (existing.length > 0) {
      // TODO: Check if sync is needed (every 7 days)
      return existing[0].id;
    }

    const result = await this.databaseService.query<{ id: string }>(`
      INSERT INTO products (
        asin, title, price, image_urls, description, 
        brand, category, features, raw_provider_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      asin,
      productData.title,
      JSON.stringify(productData.price),
      JSON.stringify(productData.imageUrls),
      productData.description,
      productData.brand || null,
      productData.manufacturer || null, // manufacturer as category fallback for now
      JSON.stringify([]), // features
      JSON.stringify(productData), // raw product data
    ]);

    return result[0].id;
  }

  /**
   * Update job item processing result
   */
  async updateJobItemResult(
    jobId: string,
    asin: string,
    data: {
      productId?: string;
      listingId?: string;
      status: ListingStatus;
      ebayItemId?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.databaseService.query(`
      UPDATE listing_job_items
      SET product_id = COALESCE($1, product_id),
          listing_id = COALESCE($2, listing_id),
          status = $3,
          ebay_item_id = $4,
          error_message = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = $6 AND asin = $7
    `, [
      data.productId || null,
      data.listingId || null,
      data.status,
      data.ebayItemId || null,
      data.errorMessage || null,
      jobId,
      asin,
    ]);

    await this.updateJobCounts(jobId);
  }

  /**
   * Update job counts and status
   */
  private async updateJobCounts(jobId: string): Promise<void> {
    const counts = await this.databaseService.query<{
      total: string | number;
      success: string | number;
      failed: string | number;
      retrying: string | number;
    }>(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as success,
        COUNT(*) FILTER (WHERE status = 'error') as failed,
        COUNT(*) FILTER (WHERE status = 'retrying') as retrying
      FROM listing_job_items
      WHERE job_id = $1
    `, [jobId]);

    const total = Number(counts[0].total);
    const success = Number(counts[0].success);
    const failed = Number(counts[0].failed);
    const retrying = Number(counts[0].retrying);
    
    // Processed count only includes FINAL terminal states
    const processed = success + failed;

    let jobStatus = ListingJobStatus.PROCESSING;
    if (processed >= total) {
      jobStatus = failed === total ? ListingJobStatus.FAILED : ListingJobStatus.COMPLETED;
      this.logger.log(`Job ${jobId} finished with status: ${jobStatus} (${success} success, ${failed} failed)`);
    }

    await this.databaseService.query(`
      UPDATE listing_jobs
      SET processed_count = $1,
          success_count = $2,
          failed_count = $3,
          status = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [processed, success, failed, jobStatus, jobId]);
  }

  /**
   * Map job entity to DTO
   */
  private mapJobToDto(entity: ListingJobEntity): ListingJobDto {
    return {
      id: entity.id,
      userId: entity.user_id,
      totalAsins: entity.total_asins,
      processedCount: entity.processed_count,
      successCount: entity.success_count,
      failedCount: entity.failed_count,
      status: entity.status as ListingJobStatus,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * Map job item entity to DTO
   */
  private mapJobItemToDto(entity: ListingJobItemEntity): ListingJobItemDto {
    return {
      id: entity.id,
      jobId: entity.job_id,
      asin: entity.asin,
      productId: entity.product_id || undefined,
      listingId: entity.listing_id || undefined,
      status: entity.status as ListingStatus,
      ebayItemId: entity.ebay_item_id || undefined,
      errorMessage: entity.error_message || undefined,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * End multiple listings on eBay
   */
  async endListings(userId: string, listingIds: string[]): Promise<number> {
    this.logger.log(`Ending ${listingIds.length} listings for user ${userId}`);
    
    let successCount = 0;
    
    for (const listingId of listingIds) {
      try {
        // 1. Get listing from DB to get the eBay item ID
        const results = await this.databaseService.query(`
          SELECT ebay_item_id FROM listings 
          WHERE id = $1 AND user_id = $2
        `, [listingId, userId]);
        
        if (results.length === 0) continue;
        
        const ebayItemId = results[0].ebay_item_id;
        
        // 2. Call eBay to end the item
        await this.ebayService.withdrawOffer(userId, ebayItemId);
        
        // 3. Update status in DB
        await this.databaseService.query(`
          UPDATE listings 
          SET status = 'inactive', updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [listingId]);
        
        successCount++;
      } catch (error: any) {
        this.logger.error(`Failed to end listing ${listingId}: ${error.message}`);
        // Continue with others
      }
    }
    
    return successCount;
  }
}
