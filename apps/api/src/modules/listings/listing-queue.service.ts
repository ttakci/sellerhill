import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
    type CreateListingsRequest,
    type ListingJobDto,
    type ListingQueueJobData,
} from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';

import { ListingsService } from './listings.service';

export interface ListingRetryInput {
  jobId: string;
  listingJobItemId: string;
  asin: string;
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
}

@Injectable()
export class ListingQueueService {
  private readonly logger = new Logger(ListingQueueService.name);

  constructor(
    @InjectQueue('listings') private readonly listingQueue: Queue,
    private readonly listingsService: ListingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
  ) {}

  /**
   * Add a bulk listing creation job to the queue.
   *
   * Billing quota gate (BILLING_ENFORCEMENT_ENABLED): for non-draft bulk
   * creates, reserve N active-listings slots under an advisory lock BEFORE
   * enqueuing. Drafts are excluded from quota (they don't occupy a slot until
   * publish). If the reserve would exceed the limit, throw QuotaExhaustedError
   * — the controller surfaces it as a structured 4xx (no jobs enqueued).
   */
  async addListingJob(
    userId: string,
    request: CreateListingsRequest,
  ): Promise<ListingJobDto> {
    const { asins } = request;

    // 1. Create job record in database (returns the created job items)
    const job = await this.listingsService.createJob(userId, request);
    this.logger.log(`Created listing job ${job.id} for user ${userId} with ${asins.length} ASINs`);

    // 2. Billing-quota gate: reserve slots for NON-DRAFT creates only. Drafts
    //    are excluded from quota (they reserve at publish time). Race-safe:
    //    reserveForBulkCreate takes a transaction-scoped advisory lock.
    const asDraft = Boolean(request.asDraft);
    if (!asDraft && job.items.length > 0) {
      await this.quotaEnforcement.reserveForBulkCreate(userId, job.items.map((i) => i.id));
    }

    // 3. Add each ASIN as a separate task to the queue for parallel processing.
    //    job.items is already deduped/filtered by createJob; align each task
    //    with its job-item id (used by the worker to consume/release the quota
    //    reservation).
    const jobs = job.items.map((item) => ({
      name: 'create-listing',
      data: stampCurrentCorrelation({
        jobId: job.id,
        userId,
        asin: item.asin,
        listingSettingsGroupId: request.listingSettingsGroupId,
        paymentPolicyId: request.paymentPolicyId,
        shippingPolicyId: request.shippingPolicyId,
        returnPolicyId: request.returnPolicyId,
        asDraft,
        listingJobItemId: item.id,
      } as ListingQueueJobData),
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

    if (jobs.length > 0) {
      await this.listingQueue.addBulk(jobs);
      this.logger.log(`Added ${jobs.length} tasks to listings queue for job ${job.id}`);
    }

    // Strip the internal items field before returning the DTO.
    const { items: _items, ...dto } = job;
    void _items;
    return dto;
  }

  /**
   * Re-queue ONE failed ASIN from an existing job.
   *
   * A failed create used to be a dead end: nothing was written to `listings`,
   * so the seller could neither fix nor retry the ASIN without re-running the
   * whole import. The queue job is identical to the original one — only the
   * single item is re-enqueued.
   */
  async retryJobItem(userId: string, item: ListingRetryInput): Promise<void> {
    await this.listingQueue.add(
      'create-listing',
      stampCurrentCorrelation({
        jobId: item.jobId,
        userId,
        asin: item.asin,
        listingSettingsGroupId: item.listingSettingsGroupId,
        paymentPolicyId: item.paymentPolicyId,
        shippingPolicyId: item.shippingPolicyId,
        returnPolicyId: item.returnPolicyId,
        asDraft: false,
        listingJobItemId: item.listingJobItemId,
      } as ListingQueueJobData),
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    this.logger.log(`Re-queued ASIN ${item.asin} for job ${item.jobId}`);
  }
}
