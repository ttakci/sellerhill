import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  KeepaUsageSource,
  ListingStatus,
  type ListingQueueJobData,
  type ProductData,
} from '@repo/shared';
import { Job } from 'bullmq';

import { EbayService } from '../ebay/ebay.service';

import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';

@Processor('listings')
export class ListingProcessorService extends WorkerHost {
  private readonly logger = new Logger(ListingProcessorService.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly keepaService: KeepaService,
    private readonly keepaUsageService: KeepaUsageService,
    private readonly ebayService: EbayService,
    private readonly listingStrategyService: ListingStrategyService
  ) {
    super();
  }

  /**
   * Process a listing job task from the queue
   */
  async process(job: Job<ListingQueueJobData>): Promise<void> {
    const { jobId, userId, asin, listingSettingsGroupId, paymentPolicyId, shippingPolicyId, returnPolicyId } = job.data;

    this.logger.log(`Processing ASIN ${asin} for job ${jobId}`);

    // 0. Check if ASIN is already actively listed for this user
    const isAlreadyListed = await this.listingsService.isAsinListed(userId, asin);
    if (isAlreadyListed) {
      this.logger.warn(`ASIN ${asin} is already listed for user ${userId}. Skipping.`);
      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: ListingStatus.ERROR,
        errorMessage: 'DUPLICATE_LISTING: This ASIN is already in your active listings.',
      });
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
      const listingData = await this.listingStrategyService.prepareListingData(
        userId,
        productData,
        listingSettingsGroupId,
        ebayAccountId
      );

      // 3.5. Validate stock - Do not list products with 0 stock
      if (listingData.quantity === 0) {
        throw new Error(
          `Cannot list ASIN ${asin}: Stock is 0. ` +
            `Amazon stock (${productData.stock}) is less than user preferred quantity. ` +
            `Please adjust your listing settings group stock preferences or wait for Amazon to restock.`
        );
      }

      // 4. Create eBay listing (REST API)
      const { listingId: ebayItemId, categoryName } = await this.ebayService.createListingWithRest(
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

      // 5. Create final listing record in our database
      const listingId = await this.listingsService.createListing({
        userId,
        asin,
        productId,
        listingSettingsGroupId,
        paymentPolicyId,
        shippingPolicyId,
        returnPolicyId,
        ebayItemId,
        title: listingData.title,
        price: listingData.price,
        purchasePrice: listingData.purchasePrice,
        estimatedProfit: listingData.estimatedProfit,
        profitMargin: listingData.profitMargin,
        roi: listingData.roi,
        quantity: listingData.quantity,
        ebayCategoryName: categoryName,
      });

      // 6. Update job item success
      await this.listingsService.updateJobItemResult(jobId, asin, {
        productId,
        listingId,
        status: ListingStatus.ACTIVE,
        ebayItemId,
      });

      this.logger.log(`Successfully created eBay listing ${ebayItemId} for ASIN ${asin}`);
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

      if (!isLastAttempt) {
        throw error; // Rethrow to trigger BullMQ retry
      }
    }
  }
}
