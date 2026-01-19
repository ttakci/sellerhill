# ASIN-Based eBay Listing Creation - Implementation Plan

## Overview

This feature enables users to bulk-create eBay listings from Amazon ASINs using Keepa API for product data, with intelligent caching, queue-based processing, and real-time status tracking.

## User Review Required

> [!IMPORTANT]
> **Keepa API Integration**: This implementation requires a Keepa API key and subscription. Please confirm:
> - Do you have an active Keepa API subscription?
> - What is the API rate limit we should respect?
> - Should we implement fallback mechanisms if Keepa is unavailable?

> [!WARNING]
> **Queue Infrastructure**: The plan uses Bull/BullMQ with Redis for job processing. This requires:
> - Redis server running (development and production)
> - Additional environment variables for Redis connection
> - Potential infrastructure costs for hosted Redis in production

> [!IMPORTANT]
> **WebSocket for Real-Time Updates**: Real-time status requires WebSocket support. Alternative: polling-based updates (simpler but less efficient).

---

## Proposed Changes

### 1. Shared Package (`packages/shared`)

#### Domain Types

##### [NEW] [`packages/shared/src/domain/products/products.types.ts`](file:///d:/dev/projects/zonds/zonds/packages/shared/src/domain/products/products.types.ts)

```typescript
/**
 * Product domain types for Amazon products cached from Keepa
 */

export interface ProductDto {
  id: string;
  asin: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  imageUrls: string[];
  brand?: string;
  category?: string;
  features?: string[];
  lastSyncAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeepaProductData {
  asin: string;
  title: string;
  description: string;
  imagesCSV: string;
  brand: string;
  categoryTree: any[];
  features: string[];
  stats: {
    current: number[];
  };
}
```

##### [MODIFY] [`packages/shared/src/domain/listings/listings.types.ts`](file:///d:/dev/projects/zonds/zonds/packages/shared/src/domain/listings/listings.types.ts)

Add queue job types and enhanced status tracking:

```typescript
export enum ListingJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ListingJobDto {
  id: string;
  userId: string;
  totalAsins: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  status: ListingJobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListingJobItemDto {
  id: string;
  jobId: string;
  asin: string;
  status: ListingStatus;
  ebayItemId?: string;
  errorMessage?: string;
  createdAt: string;
}
```

#### Validation Schemas

##### [MODIFY] [`packages/shared/src/schemas/listings/listings.schema.ts`](file:///d:/dev/projects/zonds/zonds/packages/shared/src/schemas/listings/listings.schema.ts)

Enhanced validation with ASIN deduplication:

```typescript
export const createListingsSchema = (t: any) => z.object({
  asins: z.string()
    .transform(val => {
      // Split by newlines, trim, uppercase, filter empty
      const lines = val.split('\n')
        .map(line => line.trim().toUpperCase())
        .filter(line => line.length > 0);
      
      // Deduplicate
      return [...new Set(lines)];
    })
    .pipe(
      z.array(z.string().regex(ASIN_REGEX, t('listings.validation.invalidAsin')))
        .min(1, t('listings.validation.minOneAsin'))
        .max(1000, t('listings.validation.maxAsins'))
    ),
  listingSettingsGroupId: z.string().uuid(t('common.validation.invalidUuid')),
  paymentPolicyId: z.string().min(1, t('listings.validation.paymentPolicyRequired')),
  shippingPolicyId: z.string().min(1, t('listings.validation.shippingPolicyRequired')),
});
```

---

### 2. Backend API (`apps/api`)

#### Database Entities

##### [NEW] `apps/api/src/modules/products/entities/product.entity.ts`

```typescript
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 10 })
  @Index()
  asin: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb' })
  imageUrls: string[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  brand: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  category: string;

  @Column({ type: 'jsonb', nullable: true })
  features: string[];

  @Column({ type: 'jsonb', nullable: true })
  rawKeepaData: any;

  @Column({ type: 'timestamp' })
  lastSyncAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

##### [NEW] `apps/api/src/modules/listings/entities/listing-job.entity.ts`

```typescript
@Entity('listing_jobs')
export class ListingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'int' })
  totalAsins: number;

  @Column({ type: 'int', default: 0 })
  processedCount: number;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @Column({ type: 'enum', enum: ListingJobStatus, default: ListingJobStatus.PENDING })
  @Index()
  status: ListingJobStatus;

  @OneToMany(() => ListingJobItem, item => item.job)
  items: ListingJobItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

##### [NEW] `apps/api/src/modules/listings/entities/listing-job-item.entity.ts`

```typescript
@Entity('listing_job_items')
export class ListingJobItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  jobId: string;

  @ManyToOne(() => ListingJob, job => job.items)
  @JoinColumn({ name: 'jobId' })
  job: ListingJob;

  @Column({ type: 'varchar', length: 10 })
  asin: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  listingId: string;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.DRAFT })
  status: ListingStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ebayItemId: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

##### [NEW] `apps/api/src/modules/system/entities/system-config.entity.ts`

```typescript
@Entity('system_config')
export class SystemConfig {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

#### Services

##### [NEW] `apps/api/src/modules/products/services/keepa.service.ts`

Keepa API integration with rate limiting and error handling:

```typescript
@Injectable()
export class KeepaService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.keepa.com';
  
  async getProduct(asin: string): Promise<KeepaProductData> {
    // Implement Keepa API call with retry logic
    // Handle rate limiting (respect API limits)
    // Parse response and extract relevant fields
  }
  
  async getProducts(asins: string[]): Promise<KeepaProductData[]> {
    // Batch API call (Keepa supports up to 100 ASINs per request)
  }
}
```

##### [NEW] `apps/api/src/modules/products/services/product-cache.service.ts`

Product caching and sync logic:

```typescript
@Injectable()
export class ProductCacheService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private keepaService: KeepaService,
    private configService: ConfigService,
  ) {}
  
  async getOrFetchProduct(asin: string): Promise<Product> {
    const existing = await this.productRepo.findOne({ where: { asin } });
    
    if (existing && !this.needsSync(existing)) {
      return existing;
    }
    
    const keepaData = await this.keepaService.getProduct(asin);
    return this.upsertProduct(asin, keepaData);
  }
  
  private needsSync(product: Product): boolean {
    const syncIntervalDays = this.getSyncInterval();
    const nextSync = new Date(product.lastSyncAt);
    nextSync.setDate(nextSync.getDate() + syncIntervalDays);
    return new Date() > nextSync;
  }
  
  private getSyncInterval(): number {
    // Read from system_config table, default 7 days
    return 7;
  }
}
```

##### [NEW] `apps/api/src/modules/listings/services/listing-queue.service.ts`

Bull queue setup for listing creation:

```typescript
@Injectable()
export class ListingQueueService {
  constructor(
    @InjectQueue('listings') private listingQueue: Queue,
  ) {}
  
  async addListingJob(
    userId: string,
    asins: string[],
    config: CreateListingsRequest,
  ): Promise<ListingJob> {
    const job = await this.createJobRecord(userId, asins);
    
    // Add each ASIN as a separate queue job for parallel processing
    for (const asin of asins) {
      await this.listingQueue.add('create-listing', {
        jobId: job.id,
        asin,
        userId,
        config,
      });
    }
    
    return job;
  }
}
```

##### [NEW] `apps/api/src/modules/listings/processors/listing.processor.ts`

Queue processor for creating eBay listings:

```typescript
@Processor('listings')
export class ListingProcessor {
  constructor(
    private productCacheService: ProductCacheService,
    private ebayService: EbayService,
    private listingService: ListingService,
  ) {}
  
  @Process('create-listing')
  async handleCreateListing(job: Job) {
    const { jobId, asin, userId, config } = job.data;
    
    try {
      // 1. Get/fetch product from cache
      const product = await this.productCacheService.getOrFetchProduct(asin);
      
      // 2. Apply listing settings group transformations
      const listingData = await this.prepareListingData(product, config);
      
      // 3. Create eBay listing via API
      const ebayItemId = await this.ebayService.addItem(listingData);
      
      // 4. Save listing record
      await this.listingService.createListing({
        userId,
        productId: product.id,
        asin,
        ebayItemId,
        status: ListingStatus.ACTIVE,
        ...config,
      });
      
      // 5. Update job item status
      await this.updateJobItemStatus(jobId, asin, 'success', ebayItemId);
      
    } catch (error) {
      await this.updateJobItemStatus(jobId, asin, 'error', null, error.message);
    }
  }
}
```

---

#### API Controllers

##### [NEW] `apps/api/src/modules/listings/controllers/listings.controller.ts`

```typescript
@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  @Post('bulk-create')
  async bulkCreate(
    @CurrentUser() user: User,
    @Body() dto: CreateListingsRequest,
  ): Promise<ListingJobDto> {
    return this.listingQueueService.addListingJob(
      user.id,
      dto.asins,
      dto,
    );
  }
  
  @Get('jobs/:jobId')
  async getJobStatus(
    @CurrentUser() user: User,
    @Param('jobId') jobId: string,
  ): Promise<ListingJobDto> {
    return this.listingService.getJobStatus(user.id, jobId);
  }
  
  @Get('jobs/:jobId/items')
  async getJobItems(
    @CurrentUser() user: User,
    @Param('jobId') jobId: string,
  ): Promise<ListingJobItemDto[]> {
    return this.listingService.getJobItems(user.id, jobId);
  }
}
```

---

### 3. Frontend (`apps/web`)

#### Components Structure

```
features/listings/
├── AddListingsPage.container.tsx
├── AddListingsPage.component.tsx
├── AddListingsPage.style.ts
├── AddListingsPage.types.ts
├── components/
│   ├── AsinInput.tsx
│   ├── BusinessPolicySelector.tsx
│   ├── ListingStatusDisplay.tsx
│   └── JobProgressBar.tsx
├── api/
│   └── listings.api.ts
└── index.ts
```

##### [NEW] [`apps/web/src/features/listings/AddListingsPage.component.tsx`](file:///d:/dev/projects/zonds/zonds/apps/web/src/features/listings/AddListingsPage.component.tsx)

Following TailAdmin design from screenshot with:
- Breadcrumb navigation
- ASIN textarea with counter (0/1000)
- Listing Settings Group selector
- eBay Business Policies selectors (Payment, Shipping)
- Import & Create Listings button
- Real-time status display

##### [NEW] [`apps/web/src/features/listings/api/listings.api.ts`](file:///d:/dev/projects/zonds/zonds/apps/web/src/features/listings/api/listings.api.ts)

RTK Query endpoints:

```typescript
export const listingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createListings: builder.mutation<ListingJobDto, CreateListingsRequest>({
      query: (data) => ({
        url: '/listings/bulk-create',
        method: 'POST',
        body: data,
      }),
    }),
    getJobStatus: builder.query<ListingJobDto, string>({
      query: (jobId) => `/listings/jobs/${jobId}`,
      // Enable polling for real-time updates
      pollingInterval: 2000,
    }),
    getJobItems: builder.query<ListingJobItemDto[], string>({
      query: (jobId) => `/listings/jobs/${jobId}/items`,
      pollingInterval: 2000,
    }),
    getBusinessPolicies: builder.query<EbayBusinessPolicyDto[], void>({
      query: () => '/ebay/business-policies',
    }),
  }),
});
```

---

## Verification Plan

### Automated Tests

1. **Unit Tests**:
   - Keepa service ASIN validation
   - Product cache sync logic
   - ASIN deduplication in schema
   - Queue job creation

2. **Integration Tests**:
   - Keepa API mock responses
   - Product caching flow
   - eBay listing creation
   - Queue processing

### Manual Verification

1. **UI Testing**:
   - Enter ASINs and verify counter updates
   - Test ASIN validation (invalid formats)
   - Verify duplicate removal
   - Test policy selectors
   - Verify real-time status updates

2. **API Testing**:
   - Test bulk listing creation endpoint
   - Verify queue job creation
   - Test status polling
   - Verify error handling

3. **End-to-End Flow**:
   - Submit 10 ASINs
   - Verify Keepa API calls (only for new ASINs)
   - Verify eBay listings created
   - Verify status tracking
   - Test sync interval (modify last_sync_at)

---

## Environment Variables Required

```env
# Keepa API
KEEPA_API_KEY=your_keepa_api_key
KEEPA_API_URL=https://api.keepa.com

# Redis (for Bull queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Product Sync
PRODUCT_SYNC_INTERVAL_DAYS=7
```

---

## Migration Scripts

```sql
-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  image_urls JSONB NOT NULL,
  brand VARCHAR(200),
  category VARCHAR(200),
  features JSONB,
  raw_keepa_data JSONB,
  last_sync_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_asin ON products(asin);
CREATE INDEX idx_products_last_sync ON products(last_sync_at);

-- Create listing_jobs table
CREATE TABLE listing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  total_asins INT NOT NULL,
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_listing_jobs_user ON listing_jobs(user_id);
CREATE INDEX idx_listing_jobs_status ON listing_jobs(status);

-- Create listing_job_items table
CREATE TABLE listing_job_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES listing_jobs(id) ON DELETE CASCADE,
  asin VARCHAR(10) NOT NULL,
  product_id UUID REFERENCES products(id),
  listing_id UUID REFERENCES listings(id),
  status VARCHAR(20) DEFAULT 'draft',
  ebay_item_id VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_listing_job_items_job ON listing_job_items(job_id);

-- Create system_config table
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default config
INSERT INTO system_config (key, value, description) VALUES
('product_sync_interval_days', '7', 'Days between Keepa product data syncs');
```
