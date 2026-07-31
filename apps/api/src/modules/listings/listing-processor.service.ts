import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  extractCorrelationId,
  generateCorrelationId,
  KeepaUsageSource,
  ListingFailureCode,
  ListingStatus,
  type ListingQueueJobData,
  type ProductData,
} from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { summarizeAspectResolution } from './aspect-audit';
import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { classifyListingFailure } from './listing-failure';
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
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly databaseService: DatabaseService
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
        failureCode: ListingFailureCode.DUPLICATE_LISTING,
        failureDetails: { retryable: false },
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
      // 1. Resolve product data — cached, or one Keepa fetch guarded by a
      //    per-ASIN advisory lock so concurrent creates of the same uncached
      //    ASIN (bulk uploads, multi-tenant) make exactly ONE provider call.
      const { productData, productId } = await this.resolveProductData(asin, userId);

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
      let ebayCategoryId: string | undefined;
      let aspectAudit: { summary: Record<string, unknown>; autofilledCount: number } | undefined;

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
        ebayCategoryId = created.categoryId;
        aspectAudit = summarizeAspectResolution(created.aspectResolution);

        // Defence in depth against a phantom listing: an ACTIVE row whose
        // `ebay_item_id` is empty does not exist on eBay, can never be matched
        // to an order (order sync keys on this column), and blocks re-listing
        // the ASIN as a duplicate.
        if (!ebayItemId) {
          throw new Error(`eBay did not return a listing id for ASIN ${asin}; refusing to record the listing.`);
        }
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
        ebayCategoryId,
        aspectResolution: aspectAudit?.summary ?? null,
        aspectAutofilledCount: aspectAudit?.autofilledCount ?? 0,
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

      // One classifier owns every failure shape (ours, eBay's, transport), so
      // the UI can show an actionable reason instead of a raw eBay string.
      const failure = classifyListingFailure(error);

      this.logger.error(
        `Error processing ASIN ${asin} in job ${jobId}: [${failure.code}] ${failure.message} ` +
          `(Attempt ${job.attemptsMade + 1})`
      );

      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: isLastAttempt ? ListingStatus.ERROR : ListingStatus.RETRYING,
        errorMessage: failure.message,
        failureCode: failure.code,
        failureDetails: failure.details,
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

  /**
   * Cached-or-fetch product resolution for the create path.
   *
   * - Cache hit (valid title + images): 0 Keepa tokens; the product is already
   *   on the stale-driven refresh schedule. Re-listing never blocks on Keepa.
   * - Cache miss: pg advisory lock keyed on the ASIN serializes concurrent
   *   creates; after acquiring the lock the cache is re-checked, so N parallel
   *   jobs for one uncached ASIN produce exactly one Keepa call.
   * - Usage + balance are recorded from the response meta BEFORE product
   *   validation — tokens Keepa charged for an empty/invalid response are real
   *   spend and must not vanish from accounting.
   */
  private async resolveProductData(
    asin: string,
    userId: string
  ): Promise<{ productData: ProductData; productId: string }> {
    const cached = this.asUsableCache(await this.listingsService.getProductByAsin(asin));
    if (cached) {
      this.logger.log(`Using cached product data for ASIN ${asin} (no Keepa call)`);
      return cached;
    }

    // Advisory lock scope: this transaction/connection only. hashtext() maps
    // the ASIN into the bigint keyspace; collisions merely over-serialize.
    return this.databaseService.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('keepa-create'), hashtext($1))`, [asin]);

      // Another worker may have fetched + cached while we waited on the lock.
      const cachedAfterLock = this.asUsableCache(await this.listingsService.getProductByAsin(asin));
      if (cachedAfterLock) {
        this.logger.log(`ASIN ${asin} was cached by a concurrent create while waiting on lock (no Keepa call)`);
        return cachedAfterLock;
      }

      this.logger.log(`Fetching product data for ASIN ${asin} from Keepa`);
      const { product: keepaProduct, meta } = await this.keepaService.getProductDetailsWithMeta(asin);

      // Record real token spend + balance snapshot regardless of data quality.
      await this.keepaUsageService.logUsage({
        asin,
        tokens: meta.tokensConsumed,
        source: KeepaUsageSource.CREATE,
        userIds: [userId],
      });
      await this.keepaUsageService.captureBalance(meta);

      if (!keepaProduct) {
        throw new Error(
          `Keepa returned no product for ASIN ${asin}. The ASIN may be invalid or Amazon is blocking the request.`
        );
      }
      if (!keepaProduct.title || keepaProduct.title === 'Unknown Product') {
        throw new Error(`Keepa could not resolve a valid title for ASIN ${asin}.`);
      }

      keepaProduct.rawKeepaData = keepaProduct.raw;
      this.logger.log(
        `Keepa data received: price=${keepaProduct.price.current} USD, stock=${keepaProduct.stock ?? 0}`
      );

      const productId = await this.listingsService.findOrCreateProduct(asin, keepaProduct);
      return { productData: keepaProduct, productId };
    });
  }

  /** A cached product row is reusable when it has a real title and ≥1 image. */
  private asUsableCache(
    existing: { id: string; data: ProductData } | null
  ): { productData: ProductData; productId: string } | null {
    if (
      existing &&
      existing.data.title &&
      existing.data.title !== 'Unknown Product' &&
      existing.data.imageUrls?.length > 0
    ) {
      return { productData: existing.data, productId: existing.id };
    }
    return null;
  }
}
