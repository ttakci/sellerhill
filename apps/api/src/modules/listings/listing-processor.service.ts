import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  extractCorrelationId,
  generateCorrelationId,
  KeepaUsageSource,
  ListingStatus,
  type ListingQueueJobData,
  type ProductData,
} from '@repo/shared';
import { Job } from 'bullmq';

import { withCorrelation } from '../../common/observability/correlation.context';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';

function listingsWorkerConcurrency(): number {
  const raw = Number(process.env.LISTINGS_WORKER_CONCURRENCY ?? 2);
  if (!Number.isFinite(raw)) {
    return 2;
  }
  return Math.min(16, Math.max(1, Math.floor(raw)));
}

@Processor('listings', { concurrency: listingsWorkerConcurrency() })
export class ListingProcessorService extends WorkerHost {
  private readonly logger = new Logger(ListingProcessorService.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly keepaService: KeepaService,
    private readonly keepaUsageService: KeepaUsageService,
    private readonly ebayService: EbayService,
    private readonly listingStrategyService: ListingStrategyService,
    private readonly quotaEnforcement: QuotaEnforcementService
  ) {
    super();
  }

  /**
   * Process a listing job task from the queue
   */
  async process(job: Job<ListingQueueJobData>): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: 'listings',
        jobId: job.id,
        origin: 'worker',
      },
      () => this.processListing(job)
    );
  }

  private async processListing(job: Job<ListingQueueJobData>): Promise<void> {
    const {
      jobId,
      userId,
      asin,
      listingSettingsGroupId,
      paymentPolicyId,
      shippingPolicyId,
      returnPolicyId,
      asDraft = false,
      listingJobItemId,
    } = job.data;

    this.logger.log(`Processing ASIN ${asin} for job ${jobId}${asDraft ? ' (draft)' : ''}`);

    // 0. Check if ASIN is already active or draft for this user
    const isAlreadyListed = await this.listingsService.isAsinListed(userId, asin);
    if (isAlreadyListed) {
      this.logger.warn(`ASIN ${asin} is already listed/draft for user ${userId}. Skipping.`);
      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: ListingStatus.ERROR,
        errorMessage: 'DUPLICATE_LISTING: This ASIN is already in your active or draft listings.',
      });
      // A duplicate never created a listing — release the reservation so the
      // held slot is freed for the next create. (Non-draft path only; drafts
      // never reserved.)
      if (!asDraft && listingJobItemId) {
        await this.quotaEnforcement.releaseForCreate(userId, listingJobItemId);
      }
      return;
    }

    try {
      // 1. Check if product already exists in DB
      const existingProduct = await this.listingsService.getProductByAsin(asin);
      let productData: ProductData | null = null;
      let productId: string | null = null;

      if (
        existingProduct &&
        existingProduct.data.title &&
        existingProduct.data.title !== 'Unknown Product' &&
        existingProduct.data.imageUrls?.length > 0
      ) {
        // Cached product: reuse as-is. No Keepa call (0 tokens) — the product is
        // already on the stale-driven refresh schedule and will be freshened
        // within its refresh interval. Re-listing must never block on Keepa.
        this.logger.log(`Using cached product data for ASIN ${asin} (no Keepa call)`);
        productId = existingProduct.id;
        productData = existingProduct.data;
      } else {
        // New (or incomplete) product: one Keepa fetch yields metadata + price +
        // stock in a single token. Keepa is the sole provider (ScraperAPI removed).
        this.logger.log(
          `${existingProduct ? 'Cached data is incomplete. ' : ''}Fetching product data for ASIN ${asin} from Keepa`
        );
        const { product: keepaProduct, meta } = await this.keepaService.getProductDetailsWithMeta(asin);

        if (!keepaProduct) {
          throw new Error(
            `Keepa returned no product for ASIN ${asin}. The ASIN may be invalid or Amazon is blocking the request.`
          );
        }

        if (!keepaProduct.title || keepaProduct.title === 'Unknown Product') {
          throw new Error(`Keepa could not resolve a valid title for ASIN ${asin}.`);
        }

        keepaProduct.rawKeepaData = keepaProduct.raw;
        productData = keepaProduct;

        this.logger.log(`Keepa data received: price=${keepaProduct.price.current} USD, stock=${keepaProduct.stock ?? 0}`);

        // Attribute this create-path token spend to the creating user.
        await this.keepaUsageService.logUsage({
          asin,
          tokens: meta.tokensConsumed,
          source: KeepaUsageSource.CREATE,
          userIds: [userId],
        });

        // 2. Cache/Find product in database (sets next_refresh_at for new rows)
        productId = await this.listingsService.findOrCreateProduct(asin, productData);
      }

      // 3. Prepare listing data (Price, stock, etc. based on strategy group)
      const ebayAccountId = await this.ebayService.getActiveAccountId(userId);
      // applyContentAi: create path only (shared LLM when group flags + LLM_CONTENT_ENABLED)
      const listingData = await this.listingStrategyService.prepareListingData(
        userId,
        productData,
        listingSettingsGroupId,
        ebayAccountId,
        { applyContentAi: true }
      );

      // Drafts: allow zero stock so users can prepare OOS ASINs and publish later.
      // Live publish: block zero stock so we never push qty 0 to eBay on create.
      if (!asDraft && listingData.quantity === 0) {
        throw new Error(
          `Cannot list ASIN ${asin}: Stock is 0. ` +
            `Amazon stock (${productData.stock}) is less than user preferred quantity. ` +
            `Please adjust your listing settings group stock preferences, wait for Amazon to restock, or save as draft.`
        );
      }

      let ebayItemId: string | undefined;
      let categoryName = productData.category ?? '';

      if (!asDraft) {
        // 4. Create eBay listing (REST API)
        const created = await this.ebayService.createListingWithRest(
          userId,
          productId,
          listingData,
          {
            paymentId: paymentPolicyId,
            shippingId: shippingPolicyId,
            returnId: returnPolicyId,
          },
          asin
        );
        ebayItemId = created.listingId;
        categoryName = created.categoryName;
      }

      // 5. Create listing record (ACTIVE with eBay id, or DRAFT without)
      const listingId = await this.listingsService.createListing({
        userId,
        asin,
        productId,
        listingSettingsGroupId,
        paymentPolicyId,
        shippingPolicyId,
        returnPolicyId,
        ebayItemId: ebayItemId ?? null,
        title: listingData.title,
        price: listingData.price,
        purchasePrice: listingData.purchasePrice,
        estimatedProfit: listingData.estimatedProfit,
        profitMargin: listingData.profitMargin,
        roi: listingData.roi,
        quantity: listingData.quantity,
        ebayCategoryName: categoryName,
        ebayAccountId: ebayAccountId || undefined,
        status: asDraft ? ListingStatus.DRAFT : ListingStatus.ACTIVE,
      });

      // 6. Update job item success (job-item ACTIVE = processed successfully)
      await this.listingsService.updateJobItemResult(jobId, asin, {
        productId,
        listingId,
        status: ListingStatus.ACTIVE,
        ebayItemId,
      });

      // 7. Consume the billing-quota reservation for this job-item (non-draft
      //    creates only — drafts never reserved). Fail-soft + idempotent.
      if (!asDraft && listingJobItemId) {
        this.quotaEnforcement.consumeForCreate(userId, listingJobItemId);
      }

      this.logger.log(
        asDraft
          ? `Successfully created draft listing ${listingId} for ASIN ${asin}`
          : `Successfully created eBay listing ${ebayItemId} for ASIN ${asin}`
      );
    } catch (error: unknown) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      // Extract detailed error message if available from eBay REST API
      let errorMessage = error instanceof Error ? error.message : String(error);
      const axiosErr =
        error instanceof Error && 'response' in error
          ? (error as {
              response?: {
                data?: {
                  errors?: Array<{ message?: string; parameters?: Array<{ name?: string; value?: string }> }>;
                  error_description?: string;
                };
              };
            })
          : null;
      if (axiosErr?.response?.data?.errors && Array.isArray(axiosErr.response.data.errors)) {
        errorMessage = axiosErr.response.data.errors
          .map((e: { message?: string; parameters?: Array<{ name?: string; value?: string }> }) => {
            const params = e.parameters
              ? ` (${e.parameters.map((p: { name?: string; value?: string }) => `${p.name}: ${p.value}`).join(', ')})`
              : '';
            return `${e.message}${params}`;
          })
          .join(' | ');
      } else if (axiosErr?.response?.data?.error_description) {
        errorMessage = axiosErr.response.data.error_description;
      }

      this.logger.error(
        `Error processing ASIN ${asin} in job ${jobId}: ${errorMessage} (Attempt ${job.attemptsMade + 1})`
      );

      // Update job item status in database
      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: isLastAttempt ? ListingStatus.ERROR : ListingStatus.RETRYING,
        errorMessage: errorMessage,
      });

      // Billing-quota release: only on PERMANENT failure (terminal ERROR). On
      // intermediate RETRYING the reservation stays held so a BullMQ retry
      // doesn't oversell the slot. Drafts never reserved.
      if (!asDraft && listingJobItemId && isLastAttempt) {
        await this.quotaEnforcement.releaseForCreate(userId, listingJobItemId);
      }

      if (!isLastAttempt) {
        throw error; // Rethrow to trigger BullMQ retry
      }
    }
  }
}
