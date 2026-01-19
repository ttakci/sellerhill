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
      // 1. Check if product already exists in DB
      let productData = await this.listingsService.getProductByAsin(asin);
      let productId: string | null = null;

      if (productData) {
        this.logger.log(`Using cached product data for ASIN ${asin}`);
        // We still need the ID for listing creation
        productId = await this.listingsService.findOrCreateProduct(asin, productData);
      } else {
        // 2. Fetch product details from ScraperAPI if not in DB
        this.logger.log(`Scraping product data for ASIN ${asin} from ScraperAPI`);
        productData = await this.scraperApiService.getProductDetails(asin);
        if (!productData) {
          throw new Error(`Failed to fetch product details for ${asin} from ScraperAPI`);
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
      this.logger.error(`Error processing ASIN ${asin} in job ${jobId}: ${error.message} (Attempt ${job.attemptsMade + 1})`);
      
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      // Update job item status in database
      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: isLastAttempt ? ListingStatus.ERROR : ListingStatus.RETRYING,
        errorMessage: error.message,
      });

      if (!isLastAttempt) {
        throw error; // Rethrow to trigger BullMQ retry
      }
    }
  }
}
