import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
    type CreateListingsRequest,
    type ListingJobDto,
    type ListingQueueJobData
} from '@repo/shared';
import { Queue } from 'bullmq';
import { ListingsService } from './listings.service';

@Injectable()
export class ListingQueueService {
  private readonly logger = new Logger(ListingQueueService.name);

  constructor(
    @InjectQueue('listings') private readonly listingQueue: Queue,
    private readonly listingsService: ListingsService,
  ) {}

  /**
   * Add a bulk listing creation job to the queue
   */
  async addListingJob(
    userId: string,
    request: CreateListingsRequest,
  ): Promise<ListingJobDto> {
    const { asins } = request;
    
    // 1. Create job record in database
    const job = await this.listingsService.createJob(userId, request);
    this.logger.log(`Created listing job ${job.id} for user ${userId} with ${asins.length} ASINs`);

    // 2. Add each ASIN as a separate task to the queue for parallel processing
    const jobs = asins.map((asin) => ({
      name: 'create-listing',
      data: {
        jobId: job.id,
        userId,
        asin,
        listingSettingsGroupId: request.listingSettingsGroupId,
        paymentPolicyId: request.paymentPolicyId,
        shippingPolicyId: request.shippingPolicyId,
        returnPolicyId: request.returnPolicyId,
      } as ListingQueueJobData,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }));

    await this.listingQueue.addBulk(jobs);
    this.logger.log(`Added ${jobs.length} tasks to listings queue for job ${job.id}`);

    return job;
  }
}
