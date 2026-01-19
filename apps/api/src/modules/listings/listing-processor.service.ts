import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ListingStatus, type ListingQueueJobData } from '@repo/shared';
import { Job } from 'bullmq';
import { EbayService } from '../ebay/ebay.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';
import { ScraperApiService } from './scraper-api.service';

@Processor('listings')
export class ListingProcessorService extends WorkerHost {
  private readonly logger = new Logger(ListingProcessorService.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly scraperApiService: ScraperApiService,
    private readonly ebayService: EbayService,
    private readonly listingStrategyService: ListingStrategyService,
  ) {
    super();
  }

  /**
   * Process a listing job task from the queue
   */
  async process(job: Job<ListingQueueJobData>): Promise<void> {
    const { jobId, userId, asin, listingSettingsGroupId, paymentPolicyId, shippingPolicyId, returnPolicyId } = job.data;
    
    this.logger.log(`Processing ASIN ${asin} for job ${jobId}`);

    try {
      // 1. Fetch product details from ScraperAPI
      const productData = await this.scraperApiService.getProductDetails(asin);
      if (!productData) {
        throw new Error(`Failed to fetch product details for ${asin} from ScraperAPI`);
      }

      // 2. Cache/Find product in database
      const productId = await this.listingsService.findOrCreateProduct(asin, productData);

      // 3. Prepare listing data (Price, stock, etc. based on strategy group)
      const ebayAccountId = await this.ebayService.getActiveAccountId(userId);
      const listingData = await this.listingStrategyService.prepareListingData(
        userId,
        productData,
        listingSettingsGroupId,
        ebayAccountId
      );

      // 4. Create eBay listing (REST API)
      const ebayItemId = await this.ebayService.createListingWithRest(
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
        quantity: listingData.quantity,
      });

      // 6. Update job item success
      await this.listingsService.updateJobItemResult(jobId, asin, {
        productId,
        listingId,
        status: ListingStatus.ACTIVE,
        ebayItemId,
      });

      this.logger.log(`Successfully created eBay listing ${ebayItemId} for ASIN ${asin}`);

    } catch (error: any) {
      this.logger.error(`Error processing ASIN ${asin} in job ${jobId}: ${error.message}`);
      
      // Update job item failure in database
      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: ListingStatus.ERROR,
        errorMessage: error.message,
      });

      // We don't rethrow here because we want to mark the item as failed in our DB
      // But BullMQ might retry if we rethrow. Since we handle the "error" state in DB,
      // we decide if we want BullMQ to retry.
      if (job.attemptsMade < (job.opts.attempts || 1)) {
        throw error; // Rethrow to trigger BullMQ retry
      }
    }
  }
}
