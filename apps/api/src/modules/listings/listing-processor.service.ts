import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ListingStatus, type ListingQueueJobData, type ProductData } from '@repo/shared';
import { Job } from 'bullmq';

import { EbayService } from '../ebay/ebay.service';

import { KeepaService } from './keepa.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';
import { ScraperApiService } from './scraper-api.service';

@Processor('listings')
export class ListingProcessorService extends WorkerHost {
  private readonly logger = new Logger(ListingProcessorService.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly scraperApiService: ScraperApiService,
    private readonly keepaService: KeepaService,
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
        this.logger.log(`Using cached product data for ASIN ${asin}`);
        productId = existingProduct.id;
        productData = existingProduct.data;

        // Refresh price and stock from Keepa
        try {
          this.logger.log(`Refreshing price and stock from Keepa for cached product ${asin}`);
          const keepaData = await this.keepaService.getProduct(asin);

          if (!keepaData) {
            throw new Error(`Failed to fetch current price/stock from Keepa for ASIN ${asin}`);
          }

          this.logger.log(`Keepa data received: price=${keepaData.price} USD, stock=${keepaData.stock}`);
          productData.price = {
            current: keepaData.price,
            currency: 'USD',
          };
          productData.stock = keepaData.stock;
          productData.rawKeepaData = keepaData.raw as Record<string, unknown>;
        } catch (keepaError: unknown) {
          throw new Error(
            `Listing failed: Keepa data unavailable - ${
              keepaError instanceof Error ? keepaError.message : String(keepaError)
            }`
          );
        }
      } else {
        // 2. Fetch product details from ScraperAPI if not in DB OR cached data is broken
        this.logger.log(
          `${
            existingProduct ? 'Cached data is incomplete. ' : ''
          }Scraping product metadata for ASIN ${asin} from ScraperAPI`
        );
        productData = await this.scraperApiService.getProductDetails(asin);
        if (!productData) {
          throw new Error(`Failed to fetch product details for ${asin} from ScraperAPI`);
        }

        if (!productData.title || productData.title === 'Unknown Product') {
          throw new Error(
            `ScraperAPI could not find a valid title for ASIN ${asin}. Amazon might be blocking the request or ASIN is invalid.`
          );
        }

        // 2.5. Fetch real-time price and stock from Keepa
        try {
          this.logger.log(`Fetching current price and stock from Keepa for ASIN ${asin}`);
          const keepaData = await this.keepaService.getProduct(asin);

          if (!keepaData) {
            throw new Error(`Failed to fetch price/stock from Keepa for ASIN ${asin}`);
          }

          // Override ScraperAPI price/stock with Keepa's real-time data
          this.logger.log(`Keepa data received: price=${keepaData.price} USD, stock=${keepaData.stock}`);
          productData.price = {
            current: keepaData.price,
            currency: 'USD',
          };
          productData.stock = keepaData.stock;
          productData.rawKeepaData = keepaData.raw as Record<string, unknown>;
        } catch (keepaError: unknown) {
          throw new Error(
            `Listing failed: Keepa data unavailable - ${
              keepaError instanceof Error ? keepaError.message : String(keepaError)
            }`
          );
        }

        // 3. Cache/Find product in database
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
